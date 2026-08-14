from fastapi import FastAPI, HTTPException
import asyncio
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from dotenv import load_dotenv
import os
import json
import re
import razorpay
import bcrypt
import time
from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo
from supabase import create_client, Client
from google.genai import types

load_dotenv()

_local_path = os.path.join(os.path.dirname(__file__), "adc-credentials.json")
_render_path = "/etc/secrets/adc-credentials.json"
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _render_path if os.path.exists(_render_path) else _local_path

client = genai.Client(
    vertexai=True,
    project="project-c89d95a4-4fa7-4736-986",
    location="us-central1"
)

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_KEY_ID else None

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = (
    create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None
)

FREE_MOCK_TESTS_PER_DAY = 5

# Prices in INR rupees — must match the PLANS array in App.js
PLAN_PRICES = {
    "weekly": 9,
    "monthly": 39,
    "annual": 469,
}
PLAN_DAYS = {
    "weekly": 7,
    "monthly": 30,
    "annual": 365,
}

app = FastAPI(title="GenZ Vidyalaya API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OrderRequest(BaseModel):
    plan_id: str

class VerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: str

class SignupRequest(BaseModel):
    phone: str
    mpin: str

class LoginRequest(BaseModel):
    phone: str
    mpin: str

class ConsumeRequest(BaseModel):
    phone: str

class FeedbackRequest(BaseModel):
    phone: str | None = None
    rating: int
    comment: str | None = None

def clean_json(text):
    text = (text or "").strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


_CACHE_PREFIX = "v2"

# Fast in-process L1 cache.
# Supabase remains the persistent L2 cache.
_MEMORY_CACHE: dict[str, dict] = {}
_MEMORY_CACHE_MAX = 500

_CACHE_LOCKS: dict[str, asyncio.Lock] = {}
_CACHE_LOCKS_GUARD = asyncio.Lock()
async def _get_cache_lock(cache_key: str) -> asyncio.Lock:
    async with _CACHE_LOCKS_GUARD:
        lock = _CACHE_LOCKS.get(cache_key)
        if lock is None:
            lock = asyncio.Lock()
            _CACHE_LOCKS[cache_key] = lock
        return lock


def cache_get(cache_key: str):
    # L1: process memory — fastest path
    memory_item = _MEMORY_CACHE.get(cache_key)
    if memory_item is not None:
        expires_at = memory_item.get("expires_at")
        if expires_at is None or expires_at > datetime.now(timezone.utc):
            return memory_item["content"]
        _MEMORY_CACHE.pop(cache_key, None)

    # L2: Supabase persistent cache
    if not supabase:
        return None

    try:
        res = (
            supabase.table("content_cache")
            .select("content, expires_at")
            .eq("cache_key", cache_key)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None

        row = rows[0]
        expires_at = row.get("expires_at")

        expiry = None
        if expires_at:
            try:
                expiry = datetime.fromisoformat(
                    expires_at.replace("Z", "+00:00")
                )
                if expiry <= datetime.now(timezone.utc):
                    return None
            except Exception:
                return None

        # Promote L2 → L1
        _MEMORY_CACHE[cache_key] = {
            "content": row.get("content"),
            "expires_at": expiry,
        }

        return row.get("content")

    except Exception:
        # Cache failure must never break a real response.
        return None
   


def cache_put(cache_key: str, content: dict, expires_at: datetime | None = None):
    # L1: immediately available in RAM
    if len(_MEMORY_CACHE) >= _MEMORY_CACHE_MAX:
        oldest_key = next(iter(_MEMORY_CACHE))
        _MEMORY_CACHE.pop(oldest_key, None)

    _MEMORY_CACHE[cache_key] = {
        "content": content,
        "expires_at": expires_at,
    }

    # L2: persistent Supabase cache
    if not supabase:
        return

    try:
        row = {
            "cache_key": cache_key,
            "content": content,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat() if expires_at else None,
        }

        supabase.table("content_cache").upsert(
            row,
            on_conflict="cache_key"
        ).execute()

    except Exception:
        # L1 cache already succeeded.
        # Supabase write failure must not break the response.
        pass

async def _generate_json(prompt: str) -> dict:
    """Calls Gemini once, in strict JSON mode, with one automatic repair
    pass if the model's output isn't valid JSON. Shared by both the cached
    and non-cached generation paths below."""
    start_time = time.perf_counter()
    response = await client.aio.models.generate_content(
       model="gemini-2.5-flash-lite",
        contents=prompt,
        config=types.GenerateContentConfig(
          response_mime_type="application/json",
            temperature=0.2,
        ),
    )
    print(f"GEMINI GENERATION: {time.perf_counter() - start_time:.2f}s")
    text = clean_json(response.text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        repair_response = await client.aio.models.generate_content(
           model="gemini-2.5-flash-lite",
            contents=(
                "Return ONLY valid JSON. Repair this JSON without changing its meaning. "
                "Do not add markdown, explanations, or extra keys.\n\n" + text
            ),
           config=types.GenerateContentConfig(
    response_mime_type="application/json",
    temperature=0.2,
    thinking_config=types.ThinkingConfig(thinking_budget=0),
),
        )
        return json.loads(clean_json(repair_response.text))


async def generate_json_cached(cache_key: str, prompt: str, *, expires_at: datetime | None = None):
    """For content that SHOULD be identical across users — roadmap, notes,
    topic detail, daily update. Speeds up every repeat request after the
    first."""
    cached = await asyncio.to_thread(cache_get, cache_key)
    if cached is not None:
        return cached

    lock = await _get_cache_lock(cache_key)
    async with lock:
        cached = await asyncio.to_thread(cache_get, cache_key)
        if cached is not None:
            return cached

        data = await _generate_json(prompt)
        await asyncio.to_thread(cache_put, cache_key, data, expires_at)
        return data


async def generate_json_fresh(prompt: str):
    """For content that must be different every time — mock test questions.
    Deliberately NOT cached: caching this would silently serve the exact
    same questions to every student on the same exam/difficulty, and would
    make the 'Try again with new questions' button lie."""
    return await _generate_json(prompt)

def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    return digits

def hash_mpin(mpin: str) -> str:
    return bcrypt.hashpw(mpin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_mpin(mpin: str, mpin_hash: str) -> bool:
    try:
        return bcrypt.checkpw(mpin.encode("utf-8"), mpin_hash.encode("utf-8"))
    except Exception:
        return False

def require_supabase():
    if not supabase:
        raise HTTPException(status_code=500, detail="Account system not configured on the server (.env)")

def get_user_row(phone: str):
    res = supabase.table("users").select("*").eq("phone", phone).limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None

def compute_status(user: dict) -> dict:
    """Given a raw users row, work out current premium/usage status,
    resetting the daily mock-test counter if the stored date isn't today."""
    now = datetime.now(timezone.utc)
    today = date.today().isoformat()

    is_premium = False
    if user.get("premium_expiry"):
        try:
            expiry = datetime.fromisoformat(user["premium_expiry"].replace("Z", "+00:00"))
            is_premium = expiry > now
        except Exception:
            is_premium = False

    used_today = user.get("mock_tests_used_today") or 0
    last_date = user.get("last_mock_test_date")
    if last_date != today:
        used_today = 0  # a new day — the stored counter is stale, treat as reset

    remaining = None if is_premium else max(0, FREE_MOCK_TESTS_PER_DAY - used_today)

    return {
        "phone": user["phone"],
        "is_premium": is_premium,
        "premium_expiry": user.get("premium_expiry"),
        "mock_tests_remaining_today": remaining,
        "daily_update_trial_used": bool(user.get("daily_update_trial_used")),
    }

@app.get("/")
async def root():
    return {"message": "GenZ Vidyalaya API is running"}

@app.post("/signup")
async def signup(req: SignupRequest):
    require_supabase()

    phone = normalize_phone(req.phone)

    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="Enter a valid phone number")

    if not req.mpin.isdigit() or not (4 <= len(req.mpin) <= 6):
        raise HTTPException(status_code=400, detail="MPIN must be 4-6 digits")

    try:
        existing = get_user_row(phone)

        if existing:
            raise HTTPException(
                status_code=400,
                detail="This phone number is already registered — try logging in instead"
            )

        row = {
            "phone": phone,
            "mpin_hash": hash_mpin(req.mpin),
            "is_premium": False,
            "mock_tests_used_today": 0,
            "daily_update_trial_used": False,
        }

        print("SIGNUP INSERT:", row)

        result = supabase.table("users").insert(row).execute()

        print("SIGNUP SUCCESS:", result.data)

        created_user = result.data[0] if result.data else row

        return compute_status(created_user)

    except HTTPException:
        raise

    except Exception as e:
        print("========== SIGNUP DATABASE ERROR ==========")
        print(type(e).__name__)
        print(str(e))
        print("===========================================")

        raise HTTPException(
            status_code=500,
            detail=f"Signup database error: {str(e)}"
        )

@app.post("/login")
async def login(req: LoginRequest):
    require_supabase()
    phone = normalize_phone(req.phone)
    user = get_user_row(phone)
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this phone number")
    if not verify_mpin(req.mpin, user["mpin_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect MPIN")

    return compute_status(user)

@app.get("/account-status/{phone}")
async def account_status(phone: str):
    require_supabase()
    phone = normalize_phone(phone)
    user = get_user_row(phone)
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this phone number")
    return compute_status(user)

@app.post("/consume-mock-test")
async def consume_mock_test(req: ConsumeRequest):
    """Free users get 5 mock tests per day, resetting daily. Premium users
    are unlimited. Uses the same mock_tests_used_today / last_mock_test_date
    columns that compute_status() reads, so the two stay in sync."""
    require_supabase()
    phone = normalize_phone(req.phone)
    user = get_user_row(phone)
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this phone number")

    status = compute_status(user)
    if status["is_premium"]:
        return {"allowed": True, "remaining": None}

    if status["mock_tests_remaining_today"] <= 0:
        return {"allowed": False, "remaining": 0}

    today = date.today().isoformat()
    already_today = user.get("last_mock_test_date") == today
    new_count = (user.get("mock_tests_used_today") or 0) + 1 if already_today else 1
    try:
        supabase.table("users").update({
            "mock_tests_used_today": new_count,
            "last_mock_test_date": today,
        }).eq("phone", phone).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"allowed": True, "remaining": max(0, FREE_MOCK_TESTS_PER_DAY - new_count)}

@app.post("/consume-daily-trial")
async def consume_daily_trial(req: ConsumeRequest):
    """Call this right before showing Daily Update. Free users get exactly
    one look, ever, across the lifetime of the account."""
    require_supabase()
    phone = normalize_phone(req.phone)
    user = get_user_row(phone)
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this phone number")

    status = compute_status(user)
    if status["is_premium"]:
        return {"allowed": True}

    if status["daily_update_trial_used"]:
        return {"allowed": False}

    try:
        supabase.table("users").update({"daily_update_trial_used": True}).eq("phone", phone).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"allowed": True}

@app.post("/feedback")
async def submit_feedback(req: FeedbackRequest):
    """Stores a student review/rating. Requires a 'feedback' table in
    Supabase — see the setup SQL provided alongside this file."""
    require_supabase()
    if not (1 <= req.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    row = {
        "phone": normalize_phone(req.phone) if req.phone else None,
        "rating": req.rating,
        "comment": (req.comment or "").strip()[:1000],
    }
    try:
        supabase.table("feedback").insert(row).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"submitted": True}

@app.get("/feedback")
async def list_feedback(limit: int = 20):
    """Returns the most recent feedback entries, newest first."""
    require_supabase()
    try:
        res = (
            supabase.table("feedback")
            .select("rating, comment, created_at")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return {"reviews": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/create-order")
async def create_order(req: OrderRequest):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay keys not configured on the server (.env)")
    price = PLAN_PRICES.get(req.plan_id)
    if not price:
        raise HTTPException(status_code=400, detail="Invalid plan_id")
    try:
        amount_paise = price * 100
        order = razorpay_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "payment_capture": 1,
            "notes": {"plan_id": req.plan_id},
        })
        return {
            "order_id": order["id"],
            "amount": amount_paise,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class VerifyRequestWithPhone(VerifyRequest):
    phone: str | None = None

@app.post("/verify-payment")
async def verify_payment(req: VerifyRequestWithPhone):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay keys not configured on the server (.env)")
    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": req.razorpay_order_id,
            "razorpay_payment_id": req.razorpay_payment_id,
            "razorpay_signature": req.razorpay_signature,
        })
        days = PLAN_DAYS.get(req.plan_id, 30)

        if req.phone and supabase:
            phone = normalize_phone(req.phone)
            user = get_user_row(phone)
            if user:
                expiry = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
                supabase.table("users").update({
                    "is_premium": True,
                    "premium_expiry": expiry,
                }).eq("phone", phone).execute()

        return {"verified": True, "plan_id": req.plan_id, "valid_days": days}
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Signature verification failed — payment could not be confirmed as genuine")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/roadmap/{topic:path}")
async def get_roadmap(topic: str):
    try:
        prompt = f"""You are GenZ Vidyalaya, an expert Indian education assistant.
Create a detailed learning roadmap for: {topic}

Format as JSON:
{{
    "topic": "{topic}",
    "overview": "3-4 line detailed summary",
    "stages": [
        {{
            "stage": 1,
            "title": "stage name",
            "duration": "estimated time",
            "description": "what this stage covers",
            "topics": [
                {{
                    "name": "topic name",
                    "description": "2-3 line explanation",
                    "subtopics": ["subtopic1", "subtopic2", "subtopic3"]
                }}
            ],
            "resources": ["specific book or resource name"]
        }}
    ],
    "career_paths": ["career path 1", "career path 2"],
    "exam_relevance": ["exam1", "exam2"]
}}
Return only valid JSON, no extra text."""
        return await generate_json_cached(
            f"{_CACHE_PREFIX}:roadmap:{topic}",
            prompt,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/topic-detail/{topic}/{subtopic}")
async def get_topic_detail(topic: str, subtopic: str):
    try:
        prompt = f"""You are GenZ Vidyalaya, an expert Indian education assistant.
Give a comprehensive explanation of "{subtopic}" in the context of {topic}.

Format as JSON:
{{
    "topic": "{subtopic}",
    "context": "{topic}",
    "definition_en": "Clear detailed definition in English — minimum 4-5 sentences",
    "definition_hi": "Same definition in simple Hindi",
    "key_points": ["point1", "point2", "point3", "point4"],
    "real_world_example": "A relatable real-world example",
    "exam_importance": "Why this is important for {topic}",
    "common_mistakes": ["mistake1", "mistake2"],
    "related_topics": ["related1", "related2", "related3"],
    "resources": [
        {{
            "type": "Video",
            "label": "Search YouTube for {subtopic} {topic}",
            "url": "https://www.youtube.com/results?search_query={subtopic}+{topic}",
            "source": "YouTube"
        }},
        {{
            "type": "Article",
            "label": "Wikipedia — {subtopic}",
            "url": "https://en.wikipedia.org/wiki/{subtopic}",
            "source": "Wikipedia"
        }},
        {{
            "type": "Official",
            "label": "NCERT Textbooks",
            "url": "https://ncert.nic.in/textbook.php",
            "source": "NCERT"
        }},
        {{
            "type": "Course",
            "label": "Free course covering {subtopic}",
            "url": "https://swayam.gov.in/explorer?searchText={subtopic}",
            "source": "SWAYAM (Govt. of India)"
        }}
    ]
}}
Return only valid JSON, no extra text."""
        return await generate_json_cached(
            f"{_CACHE_PREFIX}:topic:{topic}:{subtopic}",
            prompt,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/notes/{topic}")
async def get_notes(topic: str):
    try:
        prompt = f"""You are GenZ Vidyalaya, an expert Indian education assistant.
Create very detailed study notes for: {topic}

Format as JSON:
{{
    "topic": "{topic}",
    "summary": "comprehensive 4-5 line overview",
    "key_concepts": [
        {{
            "concept": "concept name",
            "explanation": "Detailed explanation minimum 4-5 sentences",
            "example": "clear real-world example",
            "remember_tip": "memory trick or tip"
        }}
    ],
    "flow_diagram": [
        {{"step": 1, "label": "Step name", "description": "what happens"}},
        {{"step": 2, "label": "Step name", "description": "what happens"}},
        {{"step": 3, "label": "Step name", "description": "what happens"}}
    ],
    "comparison_table": [
        {{"item": "concept A", "vs": "concept B", "difference": "key difference"}}
    ],
    "important_formulas": ["formula1", "formula2"],
    "exam_tips": ["tip1", "tip2", "tip3"],
    "quick_revision": ["fact1", "fact2", "fact3", "fact4", "fact5"]
}}
Return only valid JSON, no extra text."""
        return await generate_json_cached(
            f"{_CACHE_PREFIX}:notes:{topic}",
            prompt,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/quiz/{topic}")
async def generate_quiz(
    topic: str,
    num_questions: int = 30,
    difficulty: str = "intermediate",
    exam_id: str = ""
):
    try:
        style_map = {
            "upsc": "UPSC Civil Services style — statement based, two-statement correct/incorrect format",
            "ssc-cgl": "SSC CGL style — direct factual questions, one-liner answers",
            "rrb-ntpc": "RRB NTPC style — GK, reasoning, mathematics mixed",
            "banking": "Banking PO style — current affairs, financial awareness",
            "jee": "JEE Main style — physics chemistry mathematics",
            "neet": "NEET style — biology physics chemistry based on NCERT",
            "gate": "GATE style — technical engineering questions",
            "cat": "CAT style — verbal ability, data interpretation, quantitative",
        }
        style = style_map.get(exam_id, "standard MCQ format")

        prompt = f"""You are GenZ Vidyalaya, an expert Indian education assistant.
Generate exactly {num_questions} multiple choice questions for: {topic}
Difficulty: {difficulty}
Format: {style}

Rules:
- All questions must be unique
- Mix different sub-topics evenly
- Each question has exactly 4 options labeled A) B) C) D)
- Explanations must be educational, concise, and point-by-point.
- Give 3-5 short points explaining the reasoning.
- Include the key formula or concept when relevant.
- Avoid long paragraphs or unnecessary background.

Format as JSON:
{{
    "topic": "{topic}",
    "difficulty": "{difficulty}",
    "total_questions": {num_questions},
    "questions": [
        {{
            "id": 1,
            "question": "question text",
            "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
            "correct": "A",
            "explanation": "detailed explanation",
            "topic_tag": "sub-topic name"
        }}
    ]
}}
Return only valid JSON. Generate all {num_questions} questions."""
        # Deliberately NOT cached — see generate_json_fresh's docstring.
        return await generate_json_fresh(prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/daily-update/{topic}")
async def get_daily_update(topic: str):
    try:
        prompt = f"""You are GenZ Vidyalaya, an expert Indian education assistant.
Provide today's most important updates, current affairs, and GK facts for: {topic}
Focus on what Indian students need to know for their exams.

Format as JSON:
{{
    "topic": "{topic}",
    "date": "today",
    "updates": [
        {{
            "headline": "news or fact headline",
            "summary": "3-4 line explanation",
            "exam_relevance": "how this connects to the exam",
            "category": "Current Affairs / GK / Industry News / Policy / Market"
        }}
    ],
    "key_facts_today": ["fact1", "fact2", "fact3"],
    "question_of_the_day": {{
        "question": "practice question",
        "answer": "the answer",
        "explanation": "why this is correct"
    }}
}}
Provide 5 to 8 updates. Return only valid JSON, no extra text."""
        india_now = datetime.now(ZoneInfo("Asia/Kolkata"))
        next_india_day = (india_now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        return await generate_json_cached(
            f"{_CACHE_PREFIX}:daily:{topic}:{india_now.date().isoformat()}",
            prompt,
            expires_at=next_india_day.astimezone(timezone.utc),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
