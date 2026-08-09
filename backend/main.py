from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from dotenv import load_dotenv
import os
import json
import razorpay

load_dotenv()

client = genai.Client(
    vertexai=True,
    project="project-c89d95a4-4fa7-4736-986",
    location="us-central1"
)

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_KEY_ID else None

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

def clean_json(text):
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

@app.get("/")
async def root():
    return {"message": "GenZ Vidyalaya API is running"}

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

@app.post("/verify-payment")
async def verify_payment(req: VerifyRequest):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay keys not configured on the server (.env)")
    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": req.razorpay_order_id,
            "razorpay_payment_id": req.razorpay_payment_id,
            "razorpay_signature": req.razorpay_signature,
        })
        days = PLAN_DAYS.get(req.plan_id, 30)
        return {"verified": True, "plan_id": req.plan_id, "valid_days": days}
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Signature verification failed — payment could not be confirmed as genuine")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/roadmap/{topic}")
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
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return json.loads(clean_json(response.text))
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
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return json.loads(clean_json(response.text))
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
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return json.loads(clean_json(response.text))
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
- Explanations must be educational

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
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return json.loads(clean_json(response.text))
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
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return json.loads(clean_json(response.text))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    