import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Landmark, ClipboardList, TrainFront, Banknote, FlaskConical, Stethoscope,
  Microscope, Briefcase, Calculator, Scale, HeartPulse, BookOpen, PenLine,
  Video, Image as ImageIcon, Camera, Aperture, Code, Globe, LineChart,
  Palette, TrendingUp, PiggyBank, Smartphone, Laptop,
  ArrowLeft, Clock, X, ExternalLink, FileText, GraduationCap,
  ChevronDown, ChevronUp, PlayCircle, LogOut, Star, MessageSquare,
} from 'lucide-react';
import './App.css';

const API =  'https://genz-vidyalaya-api.onrender.com';
const C = {
  ink: '#10131A',
  surface: '#161B24',
  surface2: '#1D2330',
  chalk: '#F2EEE3',
  chalkDim: '#C9C5B9',
  slate: '#7A8194',
  teal: '#2F8F76',
  tealDim: '#1E5E4D',
  brass: '#D99A3D',
  hairline: '#2A3040',
  rust: '#C1613F',
  indigo: '#5C6BC0',
  sage: '#6B8F71',
  plum: '#8B6FA3',
  red: '#C1523F',
};

const ACCENTS = [C.teal, C.brass, C.rust, C.indigo, C.sage, C.plum];

const EXAM_TRACKS = [
  { id: 'upsc', name: 'UPSC CSE', tag: 'Civil services', icon: Landmark },
  { id: 'ssc-cgl', name: 'SSC CGL', tag: 'Govt job', icon: ClipboardList },
  { id: 'rrb-ntpc', name: 'RRB NTPC', tag: 'Railway', icon: TrainFront },
  { id: 'banking', name: 'Banking PO', tag: 'IBPS / SBI', icon: Banknote },
  { id: 'jee', name: 'JEE Main & Advanced', tag: 'Engineering', icon: FlaskConical },
  { id: 'neet', name: 'NEET UG', tag: 'Medical', icon: Stethoscope },
  { id: 'gate', name: 'GATE', tag: 'PG engineering', icon: Microscope },
  { id: 'cat', name: 'CAT / MBA', tag: 'Management', icon: Briefcase },
  { id: 'ca-foundation', name: 'CA Foundation', tag: 'Chartered accountancy', icon: Calculator },
  { id: 'law-clat', name: 'CLAT / Law', tag: 'Legal career', icon: Scale },
  { id: 'mbbs', name: 'MBBS Prep', tag: 'Medical school', icon: HeartPulse },
  { id: 'class12', name: 'Class 12 boards', tag: 'CBSE / state', icon: BookOpen },
  { id: 'class10', name: 'Class 10 boards', tag: 'CBSE / state', icon: PenLine },
].map((t, i) => ({ ...t, color: ACCENTS[i % ACCENTS.length] }));

const SKILL_TRACKS = [
  { id: 'video-editing', name: 'Video editing', tag: 'Creative tech', icon: Video },
  { id: 'photo-editing', name: 'Photo editing', tag: 'Creative tech', icon: ImageIcon },
  { id: 'videography', name: 'Videography', tag: 'Content creation', icon: Camera },
  { id: 'photography', name: 'Photography', tag: 'Visual arts', icon: Aperture },
  { id: 'python', name: 'Python', tag: 'Programming', icon: Code },
  { id: 'web-dev', name: 'Web development', tag: 'Tech career', icon: Globe },
  { id: 'data-science', name: 'Data science', tag: 'AI / ML', icon: LineChart },
  { id: 'graphic-design', name: 'Graphic design', tag: 'Creative', icon: Palette },
  { id: 'stock-market', name: 'Stock market', tag: 'Finance', icon: TrendingUp },
  { id: 'personal-finance', name: 'Personal finance', tag: 'Money', icon: PiggyBank },
  { id: 'digital-marketing', name: 'Digital marketing', tag: 'Growth', icon: Smartphone },
  { id: 'freelancing', name: 'Freelancing', tag: 'Earn online', icon: Laptop },
].map((t, i) => ({ ...t, color: ACCENTS[(i + 2) % ACCENTS.length] }));

const RESOURCE_STYLE = {
  Video: { label: 'Video', color: C.rust, icon: PlayCircle },
  Article: { label: 'Article', color: C.indigo, icon: FileText },
  Official: { label: 'Official', color: C.teal, icon: ExternalLink },
  Course: { label: 'Free course', color: C.brass, icon: GraduationCap },
};

const TABS = [
  { id: 'roadmap', label: 'Roadmap', labelHi: 'रोडमैप' },
  { id: 'notes', label: 'Notes', labelHi: 'नोट्स' },
  { id: 'quiz', label: 'Mock test', labelHi: 'क्विज़' },
  { id: 'daily', label: 'Daily update', labelHi: 'डेली अपडेट' },
];

const PLANS = [
  { id: 'weekly', label: 'Weekly', price: 9, duration: '7 days', days: 7, blurb: 'Try it out' },
  { id: 'monthly', label: 'Monthly', price: 39, duration: '30 days', days: 30, blurb: 'Most popular' },
  { id: 'annual', label: 'Annual', price: 469, duration: '365 days', days: 365, blurb: 'Best value' },
];

// ---------------- ACCOUNT (backend-linked — replaces old browser-only premium flag) ----------------
// Shape stored: { phone, isPremium, premiumExpiry, mockTestsRemainingToday, dailyUpdateTrialUsed }
function getAccount() {
  try {
    const raw = localStorage.getItem('genz_account');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function setAccountLS(account) {
  localStorage.setItem('genz_account', JSON.stringify(account));
}
function clearAccountLS() {
  localStorage.removeItem('genz_account');
}
function accountFromStatus(status) {
  // Maps the FastAPI compute_status() response shape onto our frontend account shape.
  return {
    phone: status.phone,
      fullName: status.full_name || '',
    isPremium: !!status.is_premium,
    premiumExpiry: status.premium_expiry || null,
    mockTestsRemainingToday: status.mock_tests_remaining_today ?? null,
    dailyUpdateTrialUsed: !!status.daily_update_trial_used,
  };
}
function daysLeft(expiryIso) {
  if (!expiryIso) return 0;
  const expiry = new Date(expiryIso).getTime();
  return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
}
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function loadProgress(trackId) {
  try {
    const raw = localStorage.getItem(`genz_progress_${trackId}`);
    return raw ? JSON.parse(raw) : { cleared: [], viewed: [] };
  } catch {
    return { cleared: [], viewed: [] };
  }
}
function saveProgress(trackId, progress) {
  try { localStorage.setItem(`genz_progress_${trackId}`, JSON.stringify(progress)); } catch {}
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [activeTab, setActiveTab] = useState('roadmap');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [lang, setLang] = useState('en');
  const [expandedStage, setExpandedStage] = useState(null);
  const [drawer, setDrawer] = useState(null);

  const [studyTime, setStudyTime] = useState(0);
  const [studyRunning, setStudyRunning] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [quizSetup, setQuizSetup] = useState(false);
  const [quizConfig, setQuizConfig] = useState({ count: 30, difficulty: 'intermediate' });
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizBatch, setQuizBatch] = useState(0);
  const [quizTotalBatches, setQuizTotalBatches] = useState(0);
  const [progress, setProgress] = useState({ cleared: [], viewed: [] });

  // ---- account / auth state ----
  const [account, setAccount] = useState(getAccount());
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signup'); // 'signup' | 'login'
  const [authPhone, setAuthPhone] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authMpin, setAuthMpin] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // fn to run right after successful auth

  // ---- paywall state ----
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState('');
  const [payingPlanId, setPayingPlanId] = useState(null);

  // ---- feedback state ----
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackDone, setFeedbackDone] = useState(false);

  const timerRef = useRef(null);
  const studyRef = useRef(null);

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && timerActive) {
      setTimerActive(false);
      setQuizSubmitted(true);
    }
    return () => clearTimeout(timerRef.current);
  }, [timerActive, timeLeft]);

  useEffect(() => {
    if (studyRunning) {
      studyRef.current = setInterval(() => setStudyTime(t => t + 1), 1000);
    } else clearInterval(studyRef.current);
    return () => clearInterval(studyRef.current);
  }, [studyRunning]);

  // On load, if we have a saved account, refresh its status from the server —
  // this is what makes a payment made on another device/tab show up here.
  useEffect(() => {
    if (account?.phone) {
      axios.get(`${API}/account-status/${encodeURIComponent(account.phone)}`)
        .then(res => {
          const fresh = accountFromStatus(res.data);
          setAccount(fresh);
          setAccountLS(fresh);
        })
        .catch(() => {
          // If the account no longer resolves server-side, don't silently trust stale local data.
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  const selectTrack = (track) => {
    setSelectedTrack(track);
    setScreen('study');
    setActiveTab('roadmap');
    setData(null);
    setStudyTime(0);
    setStudyRunning(true);
    setExpandedStage(null);
    setDrawer(null);
    setQuizSetup(false);
    setProgress(loadProgress(track.id));
    fetchContent('roadmap', track.name);
  };

  const fetchContent = async (tab, topicName) => {
    const t = topicName || selectedTrack?.name;
    if (!t) return;
    setLoading(true);
    setData(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setTimeLeft(null);
    setTimerActive(false);
    setExpandedStage(null);
    setDrawer(null);
    try {
      let res;
      if (tab === 'roadmap') res = await axios.get(`${API}/roadmap/${encodeURIComponent(t)}`);
      else if (tab === 'notes') res = await axios.get(`${API}/notes/${encodeURIComponent(t)}`);
      else if (tab === 'daily') res = await axios.get(`${API}/daily-update/${encodeURIComponent(t)}`);
      setData(res.data);
    } catch (e) {
      alert('Error: ' + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
  };

  // ---------------- AUTH ----------------
  const openAuth = (mode, afterSuccess) => {
    setAuthMode(mode);
    setAuthError('');
    setAuthPhone('');
    setAuthFullName('');
    setAuthMpin('');
    setPendingAction(() => afterSuccess || null);
    setShowAuth(true);
  };

  // Runs `action` if already logged in; otherwise opens signup and runs
  // `action` right after a successful signup/login.
  const requireAccount = (action) => {
    if (account?.phone) {
      action();
    } else {
      openAuth('signup', action);
    }
  };

  const submitAuth = async () => {
    setAuthError('');
    if (authMode === 'signup' && !authFullName.trim()) {
  setAuthError('Please enter your full name.');
  return;
}
    const phoneDigits = authPhone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
      setAuthError('Enter a valid 10-digit Indian phone number.');
      return;
    }
    if (!/^\d{4,6}$/.test(authMpin)) {
      setAuthError('MPIN must be 4 to 6 digits.');
      return;
    }
    setAuthLoading(true);
    try {
      const endpoint = authMode === 'signup' ? '/signup' : '/login';
     const res = await axios.post(`${API}${endpoint}`, {
  phone: phoneDigits,
  mpin: authMpin,
  ...(authMode === 'signup' ? { full_name: authFullName.trim() } : {}),
});
      const acc = accountFromStatus(res.data);
      setAccount(acc);
      setAccountLS(acc);
      setShowAuth(false);
      setAuthPhone('');
      setAuthFullName('');
      setAuthMpin('');
      const action = pendingAction;
      setPendingAction(null);
      if (action) action();
    } catch (e) {
      setAuthError(e.response?.data?.detail || 'Something went wrong. Try again.');
    }
    setAuthLoading(false);
  };

  const logout = () => {
    clearAccountLS();
    setAccount(null);
  };

  // ---------------- MOCK TEST (5 free/day, then paywall) ----------------
  const startQuiz = async () => {
    const t = selectedTrack?.name;
    if (!t) return;

   requireAccount(() => {
  runQuizConsumeAndStart(t);
});
  };

  const runQuizConsumeAndStart = async (t) => {
    const phone = account?.phone;
    if (!phone) return; // requireAccount should have set this before we get here
    setLoading(true);
    try {
      const consumeRes = await axios.post(`${API}/consume-mock-test`, { phone });
      if (!consumeRes.data.allowed) {
        setLoading(false);
        openPaywall('Mock tests');
        return;
      }
      // reflect updated remaining count locally
      const updated = { ...account, mockTestsRemainingToday: consumeRes.data.remaining };
      setAccount(updated);
      setAccountLS(updated);

      setData(null);
      setQuizAnswers({});
      setQuizSubmitted(false);
      setQuizBatch(0);
     const isPremium = consumeRes.data.is_premium;
const requestedCount = isPremium ? quizConfig.count : 5;

setQuizTotalBatches(Math.ceil(requestedCount / 10));

const res = await axios.post(
  `${API}/quiz/${encodeURIComponent(t)}?num_questions=${requestedCount}&difficulty=${quizConfig.difficulty}&exam_id=${selectedTrack.id}&phone=${encodeURIComponent(phone)}`
);
      setData(res.data);
      setQuizQuestions(res.data.questions || []);
      setQuizSetup(false);
     setTimeLeft(requestedCount * 72);
      setTimerActive(true);
    } catch (e) {
      alert('Error: ' + (e.response?.data?.detail || e.message));
      setTimerActive(false);
    }
    setLoading(false);
  };

  const markViewed = (topicName) => {
    setProgress(prev => {
      if (prev.viewed.includes(topicName) || prev.cleared.includes(topicName)) return prev;
      const next = { ...prev, viewed: [...prev.viewed, topicName] };
      saveProgress(selectedTrack.id, next);
      return next;
    });
  };

  const markCleared = (topicName) => {
    setProgress(prev => {
      const next = {
        viewed: prev.viewed.filter(t => t !== topicName),
        cleared: prev.cleared.includes(topicName) ? prev.cleared : [...prev.cleared, topicName],
      };
      saveProgress(selectedTrack.id, next);
      return next;
    });
  };

  const topicState = (topicName) => {
    if (progress.cleared.includes(topicName)) return 'done';
    if (progress.viewed.includes(topicName)) return 'half';
    return 'none';
  };

  const openPaywall = (reason) => {
    setPaywallReason(reason);
    setShowPaywall(true);
  };

  const subscribe = async (plan) => {
    // Payment must be tied to an account, or Supabase has no phone to upgrade.
    if (!account?.phone) {
      setShowPaywall(false);
      openAuth('signup', () => { setShowPaywall(true); });
      return;
    }
    setPayingPlanId(plan.id);
    const ok = await loadRazorpayScript();
    if (!ok) {
      alert('Could not load the payment checkout. Check your internet connection and try again.');
      setPayingPlanId(null);
      return;
    }
    try {
      const orderRes = await axios.post(`${API}/create-order`, { plan_id: plan.id });
      const { order_id, amount, currency, key_id } = orderRes.data;
      const options = {
        key: key_id,
        amount,
        currency,
        order_id,
        name: 'GenZ Vidyalaya',
        description: `${plan.label} premium plan`,
        theme: { color: C.teal },
        handler: async function (response) {
          try {
             await axios.post(`${API}/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: plan.id,
              phone: account.phone,
            });
            // Pull fresh status from the server rather than trusting the client-side plan
            // duration blindly — this is the actual source of truth now.
            const statusRes = await axios.get(`${API}/account-status/${encodeURIComponent(account.phone)}`);
            const fresh = accountFromStatus(statusRes.data);
            setAccount(fresh);
            setAccountLS(fresh);
            setShowPaywall(false);
          } catch (e) {
            alert('Payment went through but verification failed. If money was deducted, contact support before retrying.');
          }
          setPayingPlanId(null);
        },
        modal: {
          ondismiss: () => setPayingPlanId(null),
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      alert('Could not start payment: ' + (e.response?.data?.detail || e.message));
      setPayingPlanId(null);
    }
  };

  // ---------------- TOPIC DETAIL DRAWER (fully premium, zero free views) ----------------
 const openTopicDrawer = async (topicName) => {
  setDrawer({ topic: topicName, loading: true });

  markViewed(topicName);

  try {
    const res = await axios.get(
      `${API}/topic-detail/${encodeURIComponent(selectedTrack?.name)}/${encodeURIComponent(topicName)}`
    );

    setDrawer({
      topic: topicName,
      ...res.data,
      loading: false
    });
  } catch (e) {
    setDrawer({
      topic: topicName,
      loading: false,
      error: true
    });
  }
};

  // ---------------- TAB SWITCHING — roadmap & notes are always free ----------------
  const switchTab = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'quiz') { setQuizSetup(true); setData(null); return; }
    if (tabId === 'daily') { openDailyUpdate(); return; }
    fetchContent(tabId);
  };

  // ---------------- DAILY UPDATE (1 free lifetime view, then paywall) ----------------
  const openDailyUpdate = () => {
    requireAccount(async () => {
      const phone = account?.phone;
      if (!phone) return;
      setLoading(true);
      try {
        const gate = await axios.post(`${API}/consume-daily-trial`, { phone });
        if (!gate.data.allowed) {
          setLoading(false);
          openPaywall('Daily current affairs updates');
          return;
        }
        const updated = { ...account, dailyUpdateTrialUsed: true };
        setAccount(updated);
        setAccountLS(updated);
        await fetchContent('daily');
      } catch (e) {
        setLoading(false);
        alert('Error: ' + (e.response?.data?.detail || e.message));
      }
    });
  };

  const getScore = () => !data?.questions ? 0 : data.questions.filter(q => quizAnswers[q.id] === q.correct).length;

  const getTopicScores = () => {
    if (!data?.questions) return {};
    const scores = {};
    data.questions.forEach(q => {
      const tag = q.topic_tag || 'General';
      if (!scores[tag]) scores[tag] = { correct: 0, total: 0 };
      scores[tag].total++;
      if (quizAnswers[q.id] === q.correct) scores[tag].correct++;
    });
    return scores;
  };

  // ---------------- FEEDBACK ----------------
  const submitFeedback = async () => {
    setFeedbackError('');
    if (feedbackRating < 1) {
      setFeedbackError('Pick a star rating first.');
      return;
    }
    setFeedbackLoading(true);
    try {
      await axios.post(`${API}/feedback`, {
        phone: account?.phone || null,
        rating: feedbackRating,
        comment: feedbackComment.trim() || null,
      });
      setFeedbackDone(true);
    } catch (e) {
      setFeedbackError(e.response?.data?.detail || 'Could not submit feedback. Try again.');
    }
    setFeedbackLoading(false);
  };

  const closeFeedback = () => {
    setShowFeedback(false);
    setFeedbackDone(false);
    setFeedbackRating(0);
    setFeedbackComment('');
    setFeedbackError('');
  };



const AccountIndicator = () => (
  account?.phone ? (
    <div style={s.accountWrap}>
      <button
        style={s.accountInitial}
        onClick={() => setShowAccountDetails(v => !v)}
        title="Account"
      >
        {(account.fullName || 'Student').trim().charAt(0).toUpperCase()}
      </button>

      {showAccountDetails && (
        <div style={s.accountDetails}>
          <div style={s.accountDetailsName}>
            {account.fullName || 'Student'}
          </div>

          <div style={s.accountDetailsPhone}>
            {account.phone.slice(0, 2)}••••••{account.phone.slice(-2)}
          </div>

          <div style={s.accountDetailsPlan}>
            {account.isPremium
              ? `Premium · ${daysLeft(account.premiumExpiry)} days`
              : 'Free'}
          </div>

          <button
            style={s.logoutBtn}
            onClick={logout}
            title="Log out"
          >
            <LogOut size={13} />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  ) : (
    <button
      style={s.loginBtn}
      onClick={() => openAuth('signup')}
    >
      Log in
    </button>
  )
);
  // ---------------- HOME ----------------
  if (screen === 'home') {
    const totalCleared = EXAM_TRACKS.concat(SKILL_TRACKS).reduce((sum, t) => sum + loadProgress(t.id).cleared.length, 0);
    return (
      <div style={s.app}>
        <nav style={s.nav}>
          <div style={s.logo}>GenZ <span style={{ color: C.teal }}>Vidyalaya</span></div>
          <div style={s.navRight}>
            <button style={s.feedbackNavBtn} onClick={() => setShowFeedback(true)}>
              <MessageSquare size={13} /> Feedback
            </button>
            <AccountIndicator />
            <button style={s.langToggle} onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')}>
              {lang === 'en' ? 'हिं' : 'EN'}
            </button>
          </div>
        </nav>

        <div style={s.hero}>
          <div style={s.eyebrow}><span style={s.eyebrowDot} />{lang === 'en' ? 'Roadmaps & notes free · no login required' : 'रोडमैप और नोट्स मुफ्त · लॉगिन ज़रूरी नहीं'}</div>
          <h1 style={s.h1}>{lang === 'en' ? 'Study for your exam like it\'s an answer sheet, not a syllabus PDF' : 'अपनी परीक्षा की तैयारी उत्तर पत्रक की तरह करें'}</h1>
          <p style={s.heroP}>{lang === 'en'
            ? 'AI-built roadmaps, notes, mock tests and daily current affairs for every major Indian competitive exam — in English and Hindi.'
            : 'हर प्रमुख भारतीय प्रतियोगी परीक्षा के लिए AI-निर्मित रोडमैप, नोट्स, मॉक टेस्ट और डेली करंट अफेयर्स — अंग्रेज़ी और हिंदी में।'}</p>
          <div style={s.heroStats}>
            <div style={s.stat}><span style={s.statNum}>{EXAM_TRACKS.length + SKILL_TRACKS.length}</span><span style={s.statLabel}>{lang === 'en' ? 'tracks' : 'ट्रैक'}</span></div>
            <div style={s.stat}><span style={s.statNum}>{totalCleared}</span><span style={s.statLabel}>{lang === 'en' ? 'topics cleared by you' : 'आपके पूर्ण विषय'}</span></div>
          </div>
        </div>

        <div style={s.homeContent}>
          <div style={s.sectionHead}>
            <span style={s.sectionTitle}>{lang === 'en' ? 'Competitive exams' : 'प्रतियोगी परीक्षाएं'}</span>
          </div>
          <div style={s.trackGrid}>
            {EXAM_TRACKS.map(track => {
              const Icon = track.icon;
              return (
                <div key={track.id} style={s.trackCard} onClick={() => selectTrack(track)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.slate}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.hairline}>
                  <div style={{ ...s.trackIconWrap, color: track.color }}><Icon size={22} strokeWidth={1.75} /></div>
                  <div style={s.trackName}>{track.name}</div>
                  <div style={s.trackTag}>{track.tag}</div>
                </div>
              );
            })}
          </div>

          <div style={s.sectionHead}>
            <span style={s.sectionTitle}>{lang === 'en' ? 'Trending skills' : 'ट्रेंडिंग स्किल्स'}</span>
          </div>
          <div style={s.trackGrid}>
            {SKILL_TRACKS.map(track => {
              const Icon = track.icon;
              return (
                <div key={track.id} style={s.trackCard} onClick={() => selectTrack(track)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.slate}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.hairline}>
                  <div style={{ ...s.trackIconWrap, color: track.color }}><Icon size={22} strokeWidth={1.75} /></div>
                  <div style={s.trackName}>{track.name}</div>
                  <div style={s.trackTag}>{track.tag}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={s.footer}>genz vidyalaya · built for students who can't afford Rs.1,00,000 coaching</div>

        {AuthModal()}
       <FeedbackModal
  showFeedback={showFeedback}
  closeFeedback={closeFeedback}
  feedbackDone={feedbackDone}
  feedbackRating={feedbackRating}
  setFeedbackRating={setFeedbackRating}
  feedbackComment={feedbackComment}
  setFeedbackComment={setFeedbackComment}
  feedbackError={feedbackError}
  feedbackLoading={feedbackLoading}
  submitFeedback={submitFeedback}
/>
      </div>
    );
  }

  // ---------------- STUDY ----------------
  return (
    <div style={s.app}>
      <div style={s.studyHeader}>
        <button style={s.backBtn} onClick={() => { setScreen('home'); setStudyRunning(false); setDrawer(null); }}>
          <ArrowLeft size={15} /> {lang === 'en' ? 'Back' : 'वापस'}
        </button>
        <div style={s.studyTitleWrap}>
          {selectedTrack && <selectedTrack.icon size={18} color={selectedTrack.color} strokeWidth={1.75} />}
          <span style={s.studyTitle}>{selectedTrack?.name}</span>
        </div>
        <div style={s.headerRight}>
          <AccountIndicator />
          {!account?.isPremium && (
            <button style={s.upgradeBtn} onClick={() => openPaywall('Premium features')}>Upgrade</button>
          )}
          <div style={s.studyTimer}><Clock size={13} /> {formatTime(studyTime)}</div>
          <button style={s.langToggle} onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')}>
            {lang === 'en' ? 'हिं' : 'EN'}
          </button>
        </div>
      </div>

      <div style={s.tabs}>
        {TABS.map(tab => (
          <button key={tab.id} style={{ ...s.tab, ...(activeTab === tab.id ? { color: C.chalk, borderBottomColor: selectedTrack?.color } : {}) }} onClick={() => switchTab(tab.id)}>
            {lang === 'en' ? tab.label : tab.labelHi}
          </button>
        ))}
      </div>

      {activeTab === 'quiz' && timeLeft !== null && (
        <div style={{ ...s.timerBar, borderBottomColor: timeLeft < 60 ? C.red : C.hairline }}>
          <span style={{ color: timeLeft < 60 ? C.red : C.chalk, fontWeight: 500, fontFamily: 'IBM Plex Mono, monospace', fontSize: '17px' }}>{formatTime(timeLeft)}</span>
          <span style={{ color: C.slate, fontSize: '12px' }}>{timeLeft < 60 ? 'Less than a minute left' : 'Time remaining'}</span>
          {!quizSubmitted && <button style={s.submitEarlyBtn} onClick={() => { setTimerActive(false); setQuizSubmitted(true); }}>Submit now</button>}
        </div>
      )}

      <div style={{ display: 'flex' }}>
        <div style={{ ...s.content, flex: 1, marginRight: drawer ? '400px' : '0', transition: 'margin-right 0.25s ease' }}>

          {loading && <div style={s.loading}><p>Getting this ready…</p></div>}

          {activeTab === 'quiz' && quizSetup && !loading && (
            <div style={s.quizSetup}>
              <h2 style={s.title}>{selectedTrack?.name} — mock test setup</h2>
              {account?.phone && !account.isPremium && (
                <p style={s.freeCountNote}>{Math.max(0, account.mockTestsRemainingToday ?? 5)} free mock test{(account.mockTestsRemainingToday ?? 5) === 1 ? '' : 's'} left today</p>
              )}
              <div style={s.setupCard}>
                <p style={s.label}>Number of questions</p>
                <div style={s.setupRow}>
                  {[30, 40, 50, 60].map(n => (
                    <button key={n} style={{ ...s.setupBtn, ...(quizConfig.count === n ? { borderColor: selectedTrack?.color, color: selectedTrack?.color, background: C.surface2 } : {}) }}
                      onClick={() => setQuizConfig(c => ({ ...c, count: n }))}>{n}</button>
                  ))}
                </div>
              </div>
              <div style={s.setupCard}>
                <p style={s.label}>Difficulty</p>
                <div style={s.setupRow}>
                  {[
                    { id: 'beginner', label: 'Beginner', desc: 'Basic concepts' },
                    { id: 'intermediate', label: 'Intermediate', desc: 'Application level' },
                    { id: 'advanced', label: 'Advanced', desc: 'Exam level' },
                  ].map(d => (
                    <button key={d.id} style={{ ...s.setupDiffBtn, ...(quizConfig.difficulty === d.id ? { borderColor: selectedTrack?.color, background: C.surface2 } : {}) }}
                      onClick={() => setQuizConfig(c => ({ ...c, difficulty: d.id }))}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: quizConfig.difficulty === d.id ? selectedTrack?.color : C.chalkDim }}>{d.label}</div>
                      <div style={{ fontSize: '11px', color: C.slate, marginTop: '4px' }}>{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={s.setupCard}>
                <p style={s.label}>Summary</p>
                <div style={{ color: C.chalkDim, fontSize: '14px', lineHeight: '1.8', fontFamily: 'IBM Plex Mono, monospace' }}>
                  <div>{quizConfig.count} questions · {quizConfig.difficulty}</div>
                  <div>{Math.floor(quizConfig.count * 72 / 60)} minutes on the clock</div>
                  <div>fresh questions every attempt</div>
                </div>
              </div>
              <button style={{ ...s.primaryBtn, background: selectedTrack?.color }} onClick={startQuiz}>Start mock test</button>
            </div>
          )}

          {/* ROADMAP — free, unlimited. Topic-detail drawer inside it is the paid part. */}
          {data && activeTab === 'roadmap' && (
            <div>
              <h2 style={s.title}>{data.topic} — {lang === 'en' ? 'roadmap' : 'रोडमैप'}</h2>
              <div style={s.card}><p style={s.overview}>{data.overview}</p></div>
              <div style={s.legend}>
                <span style={s.legendItem}><span style={s.legendDot} />Not started</span>
                <span style={s.legendItem}><span style={{ ...s.legendDot, background: `linear-gradient(180deg, ${C.teal} 50%, transparent 50%)`, borderColor: C.teal }} />In progress</span>
                <span style={s.legendItem}><span style={{ ...s.legendDot, background: C.teal, borderColor: C.teal }} />Cleared</span>
              </div>

              {data.stages?.map((stage, si) => (
                <div key={stage.stage} style={s.stageBlock}>
                  <div style={s.stageLabelRow} onClick={() => setExpandedStage(expandedStage === stage.stage ? null : stage.stage)}>
                    <span style={{ ...s.stageNum, color: selectedTrack?.color }}>{String(si + 1).padStart(2, '0')}</span>
                    <span style={s.stageTitleText}>{stage.title}</span>
                    <span style={s.stageDuration}>{stage.duration}</span>
                    {expandedStage === stage.stage ? <ChevronUp size={16} color={C.slate} /> : <ChevronDown size={16} color={C.slate} />}
                  </div>
                  {stage.description && <p style={s.stageDesc}>{stage.description}</p>}

                  {expandedStage === stage.stage && (
                    <div style={s.ledger}>
                      {stage.topics?.map((topic, i) => {
                        const topicName = typeof topic === 'string' ? topic : topic.name;
                        const topicDesc = typeof topic === 'object' ? topic.description : '';
                        const subtopics = typeof topic === 'object' ? topic.subtopics : [];
                        const state = topicState(topicName);
                        return (
                          <div key={i} style={s.nodeRow}>
                            <div style={{
                              ...s.bubble,
                              ...(state === 'done' ? { background: C.teal, borderColor: C.teal } : {}),
                              ...(state === 'half' ? { background: `linear-gradient(180deg, ${C.teal} 50%, ${C.ink} 50%)`, borderColor: C.teal } : {}),
                            }} />
                            <div style={s.nodeBody} onClick={() => openTopicDrawer(topicName)}
                              onMouseEnter={e => e.currentTarget.style.borderColor = C.slate}
                              onMouseLeave={e => e.currentTarget.style.borderColor = C.hairline}>
                              <div style={s.nodeTop}>
                                <span style={s.nodeName}>{topicName}</span>

                              </div>
                              {topicDesc && <p style={s.nodeSub}>{topicDesc}</p>}
                              {subtopics?.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                  {subtopics.map((st, j) => (
                                    <span key={j} style={{ ...s.chip, color: selectedTrack?.color, borderColor: selectedTrack?.color + '55' }}
                                      onClick={(e) => { e.stopPropagation(); openTopicDrawer(st); }}>{st}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {data.career_paths && (
                <div style={s.card}>
                  <p style={s.label}>Career paths</p>
                  {data.career_paths.map((c, i) => <div key={i} style={s.item}>{c}</div>)}
                </div>
              )}
            </div>
          )}

          {/* NOTES — always free */}
          {data && activeTab === 'notes' && (
            <div>
              <h2 style={s.title}>{data.topic} — {lang === 'en' ? 'study notes' : 'स्टडी नोट्स'}</h2>
              <div style={s.card}><p style={s.overview}>{data.summary}</p></div>

              {data.flow_diagram?.length > 0 && (
                <div style={s.card}>
                  <p style={s.label}>Flow</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                    {data.flow_diagram.map((step, i) => (
                      <React.Fragment key={i}>
                        <div style={s.flowStep}>
                          <div style={{ fontSize: '11px', color: selectedTrack?.color, fontFamily: 'IBM Plex Mono, monospace' }}>{String(step.step).padStart(2, '0')}</div>
                          <div style={{ fontSize: '13px', color: C.chalk, marginTop: '2px' }}>{step.label}</div>
                          {step.description && <div style={{ fontSize: '11px', color: C.slate, marginTop: '2px' }}>{step.description}</div>}
                        </div>
                        {i < data.flow_diagram.length - 1 && <span style={{ color: C.hairline, fontSize: '18px' }}>→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {data.comparison_table?.length > 0 && (
                <div style={s.card}>
                  <p style={s.label}>Comparison</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th style={s.th}>Concept A</th><th style={s.th}>Concept B</th><th style={s.th}>Key difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparison_table.map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.hairline}` }}>
                          <td style={s.td}>{row.item}</td><td style={s.td}>{row.vs}</td><td style={{ ...s.td, color: C.chalkDim }}>{row.difference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {data.key_concepts?.map((kc, i) => (
                <div key={i} style={s.conceptCard}>
                  <div style={{ ...s.conceptTitle, color: selectedTrack?.color }}>{kc.concept}</div>
                  <p style={s.conceptText}>{kc.explanation}</p>
                  {kc.example && <p style={s.example}>Example — {kc.example}</p>}
                  {kc.remember_tip && <p style={s.tip}>Remember: {kc.remember_tip}</p>}
                </div>
              ))}

              {data.exam_tips?.length > 0 && (
                <div style={s.card}><p style={s.label}>Exam tips</p>{data.exam_tips.map((t, i) => <div key={i} style={s.item}>{t}</div>)}</div>
              )}
              {data.quick_revision?.length > 0 && (
                <div style={s.card}><p style={s.label}>Quick revision</p>{data.quick_revision.map((r, i) => <div key={i} style={s.item}>{r}</div>)}</div>
              )}
            </div>
          )}

          {/* QUIZ */}
          {data && activeTab === 'quiz' && !quizSetup && (
            <div>
              <h2 style={s.title}>{data.topic} — {lang === 'en' ? 'mock test' : 'मॉक टेस्ट'} ({data.difficulty})</h2>
             {quizQuestions
  .slice(quizBatch * 10, (quizBatch + 1) * 10)
  .map(q => (
    <div key={q.id} style={s.questionCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', color: C.slate, fontFamily: 'IBMPlex Mono, monospace' }}>
          Q{q.id}
        </span>
        {q.topic_tag && <span style={s.tagPill}>{q.topic_tag}</span>}
      </div>

      <p style={s.question}>{q.question}</p>

      <div style={s.options}>
        {q.options?.map((opt, i) => (
          <button
            key={i}
            style={{
              ...s.option,
              ...(quizAnswers[q.id] === opt[0]
                ? {
                    borderColor: selectedTrack?.color,
                    background: C.surface2,
                    color: selectedTrack?.color
                  }
                : {}),
              ...(quizSubmitted && opt[0] === q.correct
                ? {
                    borderColor: C.teal,
                    background: C.tealDim + '33',
                    color: C.teal
                  }
                : {}),
              ...(quizSubmitted &&
              quizAnswers[q.id] === opt[0] &&
              opt[0] !== q.correct
                ? {
                    borderColor: C.red,
                    background: '#3A1D18',
                    color: '#E8A594'
                  }
                : {}),
            }}
            onClick={() =>
              !quizSubmitted &&
              setQuizAnswers(prev => ({
                ...prev,
                [q.id]: opt[0]
              }))
            }
          >
            {opt}
          </button>
        ))}
      </div>

      {quizSubmitted && (
        <div style={s.explanation}>{q.explanation}</div>
      )}
    </div>
  ))}


         {!quizSubmitted && quizQuestions.length > 0 && (
  <div style={{ marginTop: '20px' }}>
    <div style={{
      textAlign: 'center',
      color: C.slate,
      fontSize: '12px',
      marginBottom: '10px',
      fontFamily: 'IBM Plex Mono, monospace'
    }}>
      Questions {quizBatch * 10 + 1}–{Math.min((quizBatch + 1) * 10, quizQuestions.length)} of {quizQuestions.length}
    </div>

    {quizBatch < quizTotalBatches - 1 ? (
      <button
        style={{ ...s.primaryBtn, background: selectedTrack?.color }}
        onClick={() => {
          setQuizBatch(batch => batch + 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        Next 10 questions →
      </button>
    ) : (
      <button
        style={{ ...s.primaryBtn, background: selectedTrack?.color }}
        onClick={() => {
          setTimerActive(false);
          setQuizSubmitted(true);
        }}
      >
        Submit quiz
      </button>
    )}
  </div>
)}

              {quizSubmitted && (
                <div>
                  <div style={s.scoreCard}>
                    Score: {getScore()} / {data.questions?.length}
                    <div style={{ fontSize: '13px', marginTop: '8px', color: C.chalkDim, fontWeight: 400 }}>
                      {getScore() / data.questions?.length >= 0.8 ? 'Exam ready — strong result.' : getScore() / data.questions?.length >= 0.6 ? 'Good. Keep practicing.' : 'Needs more practice — see the breakdown below.'}
                    </div>
                  </div>
                  <div style={s.card}>
                    <p style={s.label}>Performance by topic</p>
                    {Object.entries(getTopicScores()).map(([tag, score], i) => (
                      <div key={i} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', color: C.chalkDim }}>{tag}</span>
                          <span style={{ fontSize: '13px', color: score.correct / score.total >= 0.6 ? C.teal : C.red, fontFamily: 'IBM Plex Mono, monospace' }}>{score.correct}/{score.total}</span>
                        </div>
                        <div style={{ background: C.hairline, borderRadius: '4px', height: '5px' }}>
                          <div style={{ background: score.correct / score.total >= 0.6 ? C.teal : C.red, height: '5px', borderRadius: '4px', width: `${(score.correct / score.total) * 100}%` }} />
                        </div>
                        {score.correct / score.total < 0.6 && <div style={{ fontSize: '11px', color: C.red, marginTop: '3px' }}>Focus more on {tag}</div>}
                      </div>
                    ))}
                  </div>
                  <button style={{ ...s.secondaryBtn, borderColor: selectedTrack?.color, color: selectedTrack?.color }}
                    onClick={() => { setQuizSetup(true); setData(null); setQuizSubmitted(false); }}>Try again with new questions</button>
                </div>
              )}
            </div>
          )}

          {/* DAILY UPDATE */}
          {data && activeTab === 'daily' && (
            <div>
              <h2 style={s.title}>{lang === 'en' ? 'Daily update' : 'डेली अपडेट'} — {data.topic}</h2>
              {data.updates?.map((update, i) => (
                <div key={i} style={{ ...s.card, borderLeft: `3px solid ${selectedTrack?.color}`, marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 500, color: C.chalk, fontFamily: 'IBM Plex Serif, serif' }}>{update.headline}</h3>
                    <span style={s.tagPill}>{update.category}</span>
                  </div>
                  <p style={s.overview}>{update.summary}</p>
                  {update.exam_relevance && <p style={{ fontSize: '12px', color: selectedTrack?.color, marginTop: '8px' }}>{update.exam_relevance}</p>}
                </div>
              ))}
              {data.key_facts_today?.length > 0 && (
                <div style={s.card}><p style={s.label}>Key facts today</p>{data.key_facts_today.map((f, i) => <div key={i} style={s.item}>{f}</div>)}</div>
              )}
              {data.question_of_the_day && (
                <div style={{ ...s.card, border: `1px solid ${selectedTrack?.color}55` }}>
                  <p style={{ ...s.label, color: selectedTrack?.color }}>Question of the day</p>
                  <p style={{ fontSize: '14px', color: C.chalk, marginTop: '8px', lineHeight: '1.6' }}>{data.question_of_the_day.question}</p>
                  <details style={{ marginTop: '12px' }}>
                    <summary style={{ fontSize: '13px', color: selectedTrack?.color, cursor: 'pointer' }}>Show answer</summary>
                    <p style={{ fontSize: '13px', color: C.teal, marginTop: '8px' }}>{data.question_of_the_day.answer}</p>
                    <p style={{ fontSize: '12px', color: C.slate, marginTop: '4px' }}>{data.question_of_the_day.explanation}</p>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SIDE DRAWER */}
        {drawer && (
          <div style={s.drawer}>
            <div style={s.drawerHeader}>
              <span style={{ ...s.drawerTitle, color: selectedTrack?.color }}>{drawer.topic}</span>
              <button style={s.closeBtn} onClick={() => setDrawer(null)}><X size={15} /></button>
            </div>

            {drawer.loading && <div style={{ textAlign: 'center', padding: '40px', color: C.slate }}>Loading details…</div>}
            {drawer.error && <div style={{ color: C.red, padding: '20px' }}>Couldn't load this. Try again.</div>}

            {!drawer.loading && !drawer.error && (
              <>
                <button
                  style={{
                    ...s.clearBtn,
                    ...(progress.cleared.includes(drawer.topic) ? { background: C.tealDim, borderColor: C.teal, color: C.teal } : {}),
                  }}
                  onClick={() => markCleared(drawer.topic)}>
                  {progress.cleared.includes(drawer.topic) ? 'Cleared' : 'Mark as cleared'}
                </button>

                <div style={s.drawerSection}>
                  <p style={s.drawerLabel}>{lang === 'en' ? 'Definition' : 'परिभाषा'}</p>
                  <p style={s.drawerText}>{lang === 'hi' && drawer.definition_hi ? drawer.definition_hi : drawer.definition_en}</p>
                </div>
                {drawer.key_points?.length > 0 && (
                  <div style={s.drawerSection}>
                    <p style={s.drawerLabel}>Key points</p>
                    {drawer.key_points.map((pt, i) => <div key={i} style={s.drawerBullet}>{pt}</div>)}
                  </div>
                )}
                {drawer.real_world_example && (
                  <div style={s.drawerSection}>
                    <p style={s.drawerLabel}>Real-world example</p>
                    <p style={{ ...s.drawerText, borderLeft: `2px solid ${selectedTrack?.color}`, paddingLeft: '12px' }}>{drawer.real_world_example}</p>
                  </div>
                )}
                {drawer.exam_importance && (
                  <div style={s.drawerSection}>
                    <p style={s.drawerLabel}>Exam importance</p>
                    <p style={{ fontSize: '13px', color: selectedTrack?.color }}>{drawer.exam_importance}</p>
                  </div>
                )}
                {drawer.related_topics?.length > 0 && (
                  <div style={s.drawerSection}>
                    <p style={s.drawerLabel}>Related topics</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {drawer.related_topics.map((rt, i) => (
                        <span key={i} style={{ ...s.chip, color: selectedTrack?.color, borderColor: selectedTrack?.color + '55' }} onClick={() => openTopicDrawer(rt)}>{rt}</span>
                      ))}
                    </div>
                  </div>
                )}
                {drawer.resources?.length > 0 && (
                  <div style={s.drawerSection}>
                    <p style={s.drawerLabel}>Resources</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      {drawer.resources.map((link, i) => {
                        const rs = RESOURCE_STYLE[link.type] || RESOURCE_STYLE['Article'];
                        const RIcon = rs.icon;
                        return (
                          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={s.resourceLink}>
                            <span style={{ color: rs.color, flexShrink: 0 }}><RIcon size={16} /></span>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: C.chalkDim, fontSize: '12.5px' }}>{link.label}</div>
                              <div style={{ color: C.slate, fontSize: '11px' }}>{rs.label}{link.source ? ` · ${link.source}` : ''}</div>
                            </div>
                            <ExternalLink size={13} color={C.slate} />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* PAYWALL */}
      {showPaywall && (
        <div style={s.paywallOverlay} onClick={() => setShowPaywall(false)}>
          <div style={s.paywallCard} onClick={(e) => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setShowPaywall(false)}><X size={15} /></button>
            <div style={s.eyebrow}><span style={s.eyebrowDot} />Premium feature</div>
            <h3 style={s.paywallTitle}>{paywallReason} needs a premium plan</h3>
            <p style={s.paywallSub}>Unlock mock tests, daily current affairs, and full topic detail with resources.</p>
            <div style={s.planGrid}>
              {PLANS.map(p => (
                <div key={p.id} style={s.planCard} onClick={() => subscribe(p)}>
                  <div style={s.planBlurb}>{p.blurb}</div>
                  <div style={s.planLabel}>{p.label}</div>
                  <div style={s.planPrice}>₹{p.price}</div>
                  <div style={s.planDuration}>{p.duration}</div>
                  <div style={{ ...s.planCta, opacity: payingPlanId === p.id ? 0.6 : 1 }}>
                    {payingPlanId === p.id ? 'Opening…' : 'Choose'}
                  </div>
                </div>
              ))}
            </div>
            <p style={s.paywallFoot}>Secure checkout via Razorpay. Cancel anytime — plans don't auto-renew.</p>
          </div>
        </div>
      )}

      {AuthModal()}
      <FeedbackModal
  showFeedback={showFeedback}
  closeFeedback={closeFeedback}
  feedbackDone={feedbackDone}
  feedbackRating={feedbackRating}
  setFeedbackRating={setFeedbackRating}
  feedbackComment={feedbackComment}
  setFeedbackComment={setFeedbackComment}
  feedbackError={feedbackError}
  feedbackLoading={feedbackLoading}
  submitFeedback={submitFeedback}
/>
    </div>
  );

  // ---------------- AUTH MODAL ----------------
  function AuthModal() {
    if (!showAuth) return null;
    return (
      <div style={s.paywallOverlay} onClick={() => setShowAuth(false)}>
        <div style={s.paywallCard} onClick={(e) => e.stopPropagation()}>
          <button style={s.closeBtn} onClick={() => setShowAuth(false)}><X size={15} /></button>
          <div style={s.eyebrow}><span style={s.eyebrowDot} />{authMode === 'signup' ? 'Create your account' : 'Log in'}</div>
          <h3 style={s.paywallTitle}>{authMode === 'signup' ? 'Sign up with phone + MPIN' : 'Log in to your account'}</h3>
          <p style={s.paywallSub}>Free to create. This is how we save your premium status, free mock test count, and daily update trial across devices.</p>

          <div style={s.authFieldWrap}>
          {authMode === 'signup' && (
  <div style={s.authFieldWrap}>
    <label style={s.label}>Full name</label>
    <input
      style={s.authInput}
      type="text"
      placeholder="Enter your full name"
      value={authFullName}
      onChange={(e) => setAuthFullName(e.target.value)}
    />
  </div>
)}
            <label style={s.label}>Phone number</label>
            <input
              style={s.authInput}
              type="tel"
              placeholder="10-digit mobile number"
              value={authPhone}
              onChange={(e) => setAuthPhone(e.target.value)}
              maxLength={10}
            />
          </div>
          <div style={s.authFieldWrap}>
            <label style={s.label}>MPIN</label>
            <input
              style={s.authInput}
              type="password"
              placeholder="4-6 digit MPIN"
              value={authMpin}
              onChange={(e) => setAuthMpin(e.target.value)}
              maxLength={6}
            />
          </div>

          {authError && <p style={s.authError}>{authError}</p>}

          <button style={{ ...s.primaryBtn, background: C.teal, opacity: authLoading ? 0.6 : 1 }} onClick={submitAuth} disabled={authLoading}>
            {authLoading ? 'Please wait…' : authMode === 'signup' ? 'Sign up' : 'Log in'}
          </button>

          <p style={s.authToggle}>
            {authMode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
            <span
              style={{ color: C.teal, cursor: 'pointer' }}
              onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthError(''); }}
            >
              {authMode === 'signup' ? 'Log in' : 'Sign up'}
            </span>
          </p>
        </div>
      </div>
    );
  }
}

// ---------------- FEEDBACK MODAL ----------------
function FeedbackModal({
  showFeedback,
  closeFeedback,
  feedbackDone,
  feedbackRating,
  setFeedbackRating,
  feedbackComment,
  setFeedbackComment,
  feedbackError,
  feedbackLoading,
  submitFeedback,
}) {
  if (!showFeedback) return null;

  return (
    <div style={s.paywallOverlay} onClick={closeFeedback}>
      <div style={s.paywallCard} onClick={(e) => e.stopPropagation()}>
        <button style={s.closeBtn} onClick={closeFeedback}>
          <X size={15} />
        </button>

        <div style={s.eyebrow}>
          <span style={s.eyebrowDot} />
          Feedback
        </div>

        <h3 style={s.paywallTitle}>
          {feedbackDone
            ? 'Thanks for the feedback!'
            : 'How is GenZ Vidyalaya working for you?'}
        </h3>

        {feedbackDone ? (
          <p style={s.paywallSub}>
            Your review helps us improve. You can close this now.
          </p>
        ) : (
          <>
            <div style={s.starRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <Star
                  key={n}
                  size={26}
                  style={{ cursor: 'pointer' }}
                  color={n <= feedbackRating ? C.brass : C.hairline}
                  fill={n <= feedbackRating ? C.brass : 'none'}
                  onClick={() => setFeedbackRating(n)}
                />
              ))}
            </div>

            <textarea
              style={s.feedbackTextarea}
              placeholder="Anything specific? (optional)"
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              maxLength={1000}
              rows={4}
            />

            {feedbackError && (
              <p style={s.authError}>{feedbackError}</p>
            )}

            <button
              style={{
                ...s.primaryBtn,
                background: C.brass,
                opacity: feedbackLoading ? 0.6 : 1,
              }}
              onClick={submitFeedback}
              disabled={feedbackLoading}
            >
              {feedbackLoading ? 'Submitting…' : 'Submit feedback'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  app: { minHeight: '100vh', background: C.ink, color: C.chalk, fontFamily: "'IBM Plex Sans', sans-serif" },

  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px', borderBottom: `1px solid ${C.hairline}` },
  navRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  logo: { fontFamily: "'IBM Plex Serif', serif", fontWeight: 500, fontSize: '19px' },
  langToggle: { padding: '6px 14px', background: 'transparent', border: `1px solid ${C.hairline}`, borderRadius: '16px', color: C.chalkDim, cursor: 'pointer', fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace" },

  feedbackNavBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'transparent', border: `1px solid ${C.hairline}`, borderRadius: '16px', color: C.chalkDim, cursor: 'pointer', fontSize: '12px' },

  accountWrap: {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
},
  accountInitial: {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  border: `1px solid ${C.hairline}`,
  background: C.surface2,
  color: C.chalk,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'IBM Plex Sans', sans-serif",
},
accountDetails: {
  position: 'absolute',
  top: '42px',
  right: 0,
  minWidth: '210px',
  padding: '14px',
  background: C.surface,
  border: `1px solid ${C.hairline}`,
  borderRadius: '10px',
  boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
  zIndex: 200,
},

accountDetailsName: {
  fontSize: '14px',
  fontWeight: 600,
  color: C.chalk,
  marginBottom: '6px',
},

accountDetailsPhone: {
  fontSize: '12px',
  color: C.slate,
  fontFamily: "'IBM Plex Mono', monospace",
  marginBottom: '8px',
},

accountDetailsPlan: {
  fontSize: '12px',
  color: C.teal,
  marginBottom: '12px',
},
  logoutBtn: { background: 'transparent', border: `1px solid ${C.hairline}`, color: C.slate, width: '26px', height: '26px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loginBtn: { padding: '6px 14px', background: C.teal, border: 'none', borderRadius: '16px', color: C.ink, cursor: 'pointer', fontSize: '12px', fontWeight: 500 },

  hero: { padding: '48px 28px 36px', borderBottom: `1px solid ${C.hairline}`, maxWidth: '760px' },
  eyebrow: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: C.brass, letterSpacing: '0.04em', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' },
  eyebrowDot: { width: '6px', height: '6px', borderRadius: '50%', background: C.brass, display: 'inline-block' },
  h1: { fontFamily: "'IBM Plex Serif', serif", fontWeight: 500, fontSize: '30px', lineHeight: '1.25', marginBottom: '14px' },
  heroP: { color: C.chalkDim, fontSize: '15px', lineHeight: '1.6', marginBottom: '22px' },
  heroStats: { display: 'flex', gap: '28px' },
  stat: { fontFamily: "'IBM Plex Mono', monospace" },
  statNum: { fontSize: '20px', color: C.teal, display: 'block' },
  statLabel: { fontSize: '11.5px', color: C.slate },

  homeContent: { padding: '40px 28px 24px', maxWidth: '1080px', margin: '0 auto' },
  sectionHead: { marginBottom: '14px', marginTop: '32px' },
  sectionTitle: { fontFamily: "'IBM Plex Serif', serif", fontSize: '17px', fontWeight: 500 },
  trackGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px' },
  trackCard: { background: C.surface, border: `1px solid ${C.hairline}`, borderRadius: '10px', padding: '16px', cursor: 'pointer', transition: 'border-color .15s ease' },
  trackIconWrap: { marginBottom: '12px' },
  trackName: { fontSize: '13.5px', fontWeight: 500, color: C.chalk, marginBottom: '4px' },
  trackTag: { fontSize: '11.5px', color: C.slate },
  footer: { borderTop: `1px solid ${C.hairline}`, padding: '24px', textAlign: 'center', color: C.slate, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace" },

  studyHeader: { background: C.surface, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: `1px solid ${C.hairline}` },
  backBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: `1px solid ${C.hairline}`, color: C.chalkDim, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  studyTitleWrap: { flex: 1, display: 'flex', alignItems: 'center', gap: '8px' },
  studyTitle: { fontSize: '15px', fontWeight: 500, color: C.chalk },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  studyTimer: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: C.brass, fontFamily: "'IBM Plex Mono', monospace", background: C.surface2, padding: '5px 10px', borderRadius: '6px' },
  premiumBadge: { fontSize: '11.5px', color: C.teal, fontFamily: "'IBM Plex Mono', monospace", background: C.tealDim + '33', border: `1px solid ${C.teal}55`, padding: '5px 10px', borderRadius: '6px' },
  upgradeBtn: { fontSize: '12px', color: C.ink, background: C.brass, border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 },

  freeCountNote: { fontSize: '12.5px', color: C.brass, marginBottom: '14px', fontFamily: "'IBM Plex Mono', monospace" },
  premiumTag: { fontSize: '10px', color: C.brass, border: `1px solid ${C.brass}55`, padding: '2px 7px', borderRadius: '9px', fontFamily: "'IBM Plex Mono', monospace" },

  paywallOverlay: { position: 'fixed', inset: 0, background: 'rgba(8,10,14,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' },
  paywallCard: { background: C.surface, border: `1px solid ${C.hairline}`, borderRadius: '14px', padding: '32px', maxWidth: '520px', width: '100%', position: 'relative' },
  paywallTitle: { fontFamily: "'IBM Plex Serif', serif", fontSize: '20px', fontWeight: 500, marginBottom: '10px', marginTop: '6px' },
  paywallSub: { fontSize: '13.5px', color: C.chalkDim, lineHeight: '1.6', marginBottom: '22px' },
  planGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  planCard: { background: C.ink, border: `1px solid ${C.hairline}`, borderRadius: '10px', padding: '16px 12px', textAlign: 'center', cursor: 'pointer' },
  planBlurb: { fontSize: '10px', color: C.brass, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '8px', fontFamily: "'IBM Plex Mono', monospace" },
  planLabel: { fontSize: '13px', color: C.chalkDim, marginBottom: '4px' },
  planPrice: { fontFamily: "'IBM Plex Serif', serif", fontSize: '22px', color: C.chalk, fontWeight: 500 },
  planDuration: { fontSize: '11px', color: C.slate, marginTop: '2px', marginBottom: '12px' },
  planCta: { fontSize: '12px', color: C.teal, fontWeight: 500 },
  paywallFoot: { fontSize: '11px', color: C.slate, marginTop: '18px', textAlign: 'center' },

  authFieldWrap: { marginBottom: '16px' },
  authInput: { width: '100%', padding: '11px 14px', background: C.ink, border: `1px solid ${C.hairline}`, borderRadius: '8px', color: C.chalk, fontSize: '14px', marginTop: '6px', boxSizing: 'border-box' },
  authError: { fontSize: '12.5px', color: C.red, marginBottom: '12px' },
  authToggle: { fontSize: '12.5px', color: C.slate, textAlign: 'center', marginTop: '16px' },

  starRow: { display: 'flex', gap: '8px', marginBottom: '18px' },
  feedbackTextarea: { width: '100%', padding: '12px 14px', background: C.ink, border: `1px solid ${C.hairline}`, borderRadius: '8px', color: C.chalk, fontSize: '13.5px', marginBottom: '16px', boxSizing: 'border-box', fontFamily: "'IBM Plex Sans', sans-serif", resize: 'vertical' },

  tabs: { display: 'flex', padding: '0 24px', borderBottom: `1px solid ${C.hairline}`, background: C.ink },
  tab: { padding: '12px 16px', background: 'transparent', border: 'none', color: C.slate, cursor: 'pointer', fontSize: '13.5px', borderBottom: '2px solid transparent' },
  timerBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid' },
  submitEarlyBtn: { background: C.surface2, color: C.chalk, border: `1px solid ${C.hairline}`, padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },

  content: { padding: '24px', maxWidth: '820px', margin: '0 auto' },
  loading: { textAlign: 'center', padding: '60px', color: C.slate },
  title: { fontFamily: "'IBM Plex Serif', serif", fontSize: '19px', fontWeight: 500, marginBottom: '16px', color: C.chalk },
  card: { background: C.surface, border: `1px solid ${C.hairline}`, borderRadius: '10px', padding: '16px', marginBottom: '12px' },
  overview: { color: C.chalkDim, lineHeight: '1.7', fontSize: '14px' },

  legend: { display: 'flex', gap: '18px', margin: '4px 0 24px', fontFamily: "'IBM Plex Mono', monospace" },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: C.slate },
  legendDot: { width: '11px', height: '11px', borderRadius: '50%', border: `1.5px solid ${C.slate}`, display: 'inline-block' },

  stageBlock: { marginBottom: '28px' },
  stageLabelRow: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 0' },
  stageNum: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px' },
  stageTitleText: { fontFamily: "'IBM Plex Serif', serif", fontSize: '15.5px', fontWeight: 500, flex: 1 },
  stageDuration: { fontFamily: "'IBM Plex Mono', monospace", color: C.slate, fontSize: '11.5px' },
  stageDesc: { fontSize: '12.5px', color: C.slate, marginBottom: '12px', paddingLeft: '2px' },

  ledger: { position: 'relative', paddingLeft: '2px' },
  nodeRow: { display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '8px 0' },
  bubble: { width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${C.slate}`, flexShrink: 0, background: C.ink, marginTop: '2px' },
  nodeBody: { flex: 1, background: C.surface, border: `1px solid ${C.hairline}`, borderRadius: '8px', padding: '13px 15px', cursor: 'pointer', transition: 'border-color .15s ease' },
  nodeTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  nodeName: { fontSize: '14px', fontWeight: 500, color: C.chalk },
  nodeSub: { fontSize: '12.5px', color: C.slate, marginTop: '6px', lineHeight: '1.5' },
  chip: { fontSize: '11px', padding: '3px 9px', border: '1px solid', borderRadius: '10px', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace" },

  label: { fontSize: '11px', color: C.slate, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '8px' },
  item: { fontSize: '13px', color: C.chalkDim, marginBottom: '6px', lineHeight: '1.5' },
  th: { textAlign: 'left', padding: '8px', color: C.slate, borderBottom: `1px solid ${C.hairline}`, fontWeight: 500 },
  td: { padding: '8px', color: C.chalk },

  flowStep: { background: C.surface2, border: `1px solid ${C.hairline}`, borderRadius: '8px', padding: '8px 12px', textAlign: 'center' },

  conceptCard: { background: C.surface, border: `1px solid ${C.hairline}`, borderRadius: '10px', padding: '16px', marginBottom: '12px' },
  conceptTitle: { fontFamily: "'IBM Plex Serif', serif", fontSize: '15px', fontWeight: 500, marginBottom: '8px' },
  conceptText: { fontSize: '14px', color: C.chalkDim, lineHeight: '1.6', marginBottom: '8px' },
  example: { fontSize: '13px', color: C.slate, lineHeight: '1.5' },
  tip: { fontSize: '12px', color: C.brass, marginTop: '8px', background: '#2A2011', padding: '8px', borderRadius: '6px' },

  questionCard: { background: C.surface, border: `1px solid ${C.hairline}`, borderRadius: '10px', padding: '16px', marginBottom: '12px' },
  question: { fontSize: '14px', fontWeight: 500, color: C.chalk, marginBottom: '12px', lineHeight: '1.6' },
  options: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' },
  option: { padding: '10px 14px', background: C.ink, border: `1px solid ${C.hairline}`, borderRadius: '8px', color: C.chalkDim, cursor: 'pointer', fontSize: '13px', textAlign: 'left' },
  explanation: { fontSize: '13px', color: C.chalkDim, marginTop: '8px', background: C.ink, padding: '10px', borderRadius: '8px', lineHeight: '1.6' },
  tagPill: { fontSize: '11px', padding: '2px 9px', background: C.surface2, color: C.slate, borderRadius: '10px' },

  scoreCard: { background: C.surface2, border: `1px solid ${C.hairline}`, borderRadius: '10px', padding: '22px', textAlign: 'center', fontSize: '20px', fontWeight: 500, color: C.chalk, marginTop: '8px', marginBottom: '16px', fontFamily: "'IBM Plex Mono', monospace" },

  quizSetup: { maxWidth: '600px' },
  setupCard: { background: C.surface, border: `1px solid ${C.hairline}`, borderRadius: '10px', padding: '20px', marginBottom: '12px' },
  setupRow: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' },
  setupBtn: { padding: '10px 20px', background: C.ink, border: `1px solid ${C.hairline}`, borderRadius: '8px', color: C.chalkDim, cursor: 'pointer', fontSize: '14px', fontFamily: "'IBM Plex Mono', monospace" },
  setupDiffBtn: { flex: 1, padding: '12px 16px', background: C.ink, border: `1px solid ${C.hairline}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'left', minWidth: '120px' },

  primaryBtn: { width: '100%', padding: '15px', color: C.ink, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 500, marginTop: '8px' },
  secondaryBtn: { width: '100%', padding: '13px', background: 'transparent', border: '1px solid', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, marginTop: '8px' },

  drawer: { position: 'fixed', right: 0, top: 0, bottom: 0, width: '400px', background: C.surface, borderLeft: `1px solid ${C.hairline}`, padding: '20px', overflowY: 'auto', zIndex: 100 },
  drawerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '16px', borderBottom: `1px solid ${C.hairline}` },
  drawerTitle: { fontFamily: "'IBM Plex Serif', serif", fontSize: '17px', fontWeight: 500, flex: 1, lineHeight: '1.3' },
  closeBtn: { background: 'transparent', border: `1px solid ${C.hairline}`, color: C.chalkDim, width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  clearBtn: { width: '100%', padding: '10px', background: 'transparent', border: `1px solid ${C.hairline}`, borderRadius: '8px', color: C.chalkDim, cursor: 'pointer', fontSize: '13px', marginBottom: '18px' },
  drawerSection: { marginBottom: '18px', paddingBottom: '16px', borderBottom: `1px solid ${C.hairline}` },
  drawerLabel: { fontSize: '11px', color: C.slate, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '8px' },
  drawerText: { fontSize: '13.5px', color: C.chalkDim, lineHeight: '1.7' },
  drawerBullet: { fontSize: '13px', color: C.chalkDim, marginBottom: '6px', lineHeight: '1.5', paddingLeft: '10px', position: 'relative' },
  resourceLink: { display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', padding: '10px 12px', background: C.ink, borderRadius: '8px', border: `1px solid ${C.hairline}` },
};
