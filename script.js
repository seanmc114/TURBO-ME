const MAX_TURNS = 3;
const TOTAL_STARS_KEY = "oral_totalStars";

const THEME_LABEL = {
  yo: "Yo y mi personalidad",
  barrio: "Mi barrio y mi casa",
  instituto: "Mi instituto",
  familia: "Mi familia",
  amigos: "Mis amigos",
  tiempo: "Tiempo libre",
  vacaciones: "Vacaciones y viajes",
  salud: "Deporte y salud",
  tecnologia: "Tecnología y redes",
  comida: "Comida y vida diaria",
  futuro: "Planes y futuro"
};

const THEME_ENGLISH = {
  yo: { present: "Talk about yourself and what kind of person you are.", past: "Talk about what you were like when you were younger.", future: "Talk about the kind of person you want to be in the future." },
  barrio: { present: "Talk about your area and your home.", past: "Talk about where you lived before.", future: "Talk about where you would like to live in the future." },
  instituto: { present: "Talk about your school.", past: "Talk about a recent day at school.", future: "Talk about school plans for the future." },
  familia: { present: "Talk about your family.", past: "Talk about something you did with your family.", future: "Talk about what you would like to do with your family in the future." },
  amigos: { present: "Talk about your friends.", past: "Talk about something you did with your friends.", future: "Talk about what you would like to do with your friends soon." },
  tiempo: { present: "Talk about your free time.", past: "Talk about what you did last weekend.", future: "Talk about what you will do next weekend." },
  vacaciones: { present: "Talk about holidays and travel.", past: "Talk about your last holiday or trip.", future: "Talk about where you would like to go in the future." },
  salud: { present: "Talk about sport and health.", past: "Talk about a sport or healthy activity you tried.", future: "Talk about how you will stay healthy in the future." },
  tecnologia: { present: "Talk about technology and social media.", past: "Talk about your recent use of technology.", future: "Talk about how you will use technology in the future." },
  comida: { present: "Talk about food and daily life.", past: "Talk about what you ate recently.", future: "Talk about what you would like to eat or do soon." },
  futuro: { present: "Talk about what matters to you about the future.", past: "Talk about what you wanted to do when you were younger.", future: "Talk about your plans for the future." }
};

let state = {
  language: localStorage.getItem("oral_language") || "es",
  theme: localStorage.getItem("oral_theme") || "yo",
  tense: localStorage.getItem("oral_tense") || "present",
  turn: 0,
  history: [],
  scores: [],
  focuses: [],
  lastAudioUrl: null,
  bank: null,
  lastSafeValue: ""
};

const qEl = document.getElementById("question");
const aEl = document.getElementById("answer");
const out = document.getElementById("out");
const pill = document.getElementById("pill");
const homeBtn = document.getElementById("homeBtn");
const readQBtn = document.getElementById("readQ");
const recordBtn = document.getElementById("recordBtn");
const submitBtn = document.getElementById("submitBtn");
const turnNoEl = document.getElementById("turnNo");

if (qEl && aEl) initPlay();

async function initPlay() {
  hidePill();
  wireButtonsSafely();
  lockInputDown(aEl);

  setTurn(1);
  setQuestion("Loading question…");
  await loadBank();

  const firstQuestion = getRandomQuestion(state.theme, state.tense);
  setQuestion(firstQuestion);
}

function hidePill() {
  if (!pill) return;
  pill.textContent = "";
  pill.style.display = "none";
}

function setTurn(n) {
  if (turnNoEl) turnNoEl.textContent = String(n);
}

function wireButtonsSafely() {
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  if (readQBtn) {
    readQBtn.addEventListener("click", () => {
      speakQuestion(getPlainQuestionText());
    });
  }

  if (recordBtn) {
    recordBtn.addEventListener("click", onRecord);
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", onSubmit);
  }
}

function questionFileForLanguage(lang) {
  if (lang === "fr") return "questions-fr.json";
  if (lang === "de") return "questions-de.json";
  return "questions.json";
}

function speechLangForLanguage(lang) {
  if (lang === "fr") return "fr-FR";
  if (lang === "de") return "de-DE";
  return "es-ES";
}

function fallbackQuestion() {
  if (state.language === "fr") return "Peux-tu parler un peu de ce thème ?";
  if (state.language === "de") return "Kannst du ein bisschen über dieses Thema sprechen?";
  return "¿Puedes hablar un poco de este tema?";
}

function setQuestion(text) {
  const q = text || fallbackQuestion();
  const eng = englishHelpForQuestion(q);
  qEl.innerHTML = `
    <div style="font-weight:800; line-height:1.4;">${escapeHtml(q)}</div>
    ${eng ? `<div style="margin-top:6px;font-size:0.92rem;opacity:0.75;line-height:1.35;">${escapeHtml(eng)}</div>` : ""}
  `;
}

function getPlainQuestionText() {
  const first = qEl.querySelector("div");
  return first ? first.textContent : qEl.textContent;
}

function englishHelpForQuestion(questionText) {
  const q = String(questionText || "").trim();
  if (state.language === "es" && state.englishLookup && state.englishLookup[q]) {
    return state.englishLookup[q];
  }
  const block = THEME_ENGLISH[state.theme] || THEME_ENGLISH.yo;
  return block[state.tense] || block.present || "";
}

async function loadBank() {
  if (state.bank) return state.bank;
  try {
    const file = questionFileForLanguage(state.language);
    state.bank = await fetch(file, { cache: "no-store" }).then(r => r.json());

    if (state.language === "es") {
      try {
        state.bankEn = await fetch("questions-en.json", { cache: "no-store" }).then(r => r.json());
        state.englishLookup = buildEnglishLookup(state.bank, state.bankEn);
      } catch {
        state.bankEn = null;
        state.englishLookup = {};
      }
    } else {
      state.bankEn = null;
      state.englishLookup = {};
    }
  } catch {
    state.bank = {};
    state.bankEn = null;
    state.englishLookup = {};
  }
  return state.bank;
}

function normaliseTheme(theme) {
  const t = String(theme || "yo").trim().toLowerCase();
  if (state.bank && state.bank[t]) return t;
  return "yo";
}

function normaliseTense(tense) {
  const t = String(tense || "present").trim().toLowerCase();
  return ["present", "past", "future"].includes(t) ? t : "present";
}

function buildEnglishLookup(sourceBank, englishBank) {
  const lookup = {};
  if (!sourceBank || !englishBank) return lookup;

  Object.keys(sourceBank).forEach(theme => {
    const sourceTheme = sourceBank[theme] || {};
    const englishTheme = englishBank[theme] || {};

    ["present", "past", "future"].forEach(tense => {
      const sourceList = Array.isArray(sourceTheme[tense]) ? sourceTheme[tense] : [];
      const englishList = Array.isArray(englishTheme[tense]) ? englishTheme[tense] : [];

      sourceList.forEach((question, index) => {
        const english = englishList[index];
        if (question && english) lookup[String(question).trim()] = String(english).trim();
      });
    });
  });

  return lookup;
}


function getQuestionList(theme, tense) {
  const bank = state.bank || {};
  const safeTheme = normaliseTheme(theme);
  const safeTense = normaliseTense(tense);
  const themeBlock = bank[safeTheme];

  if (!themeBlock) return [];

  if (Array.isArray(themeBlock)) {
    return themeBlock.filter(Boolean);
  }

  const exact = themeBlock[safeTense];
  if (Array.isArray(exact) && exact.length) {
    return exact.filter(Boolean);
  }

  const merged = []
    .concat(Array.isArray(themeBlock.present) ? themeBlock.present : [])
    .concat(Array.isArray(themeBlock.past) ? themeBlock.past : [])
    .concat(Array.isArray(themeBlock.future) ? themeBlock.future : [])
    .filter(Boolean);

  return merged;
}

function getAnyQuestionFromBank() {
  const bank = state.bank || {};
  for (const themeKey of Object.keys(bank)) {
    const block = bank[themeKey];

    if (Array.isArray(block) && block.length) {
      return block[Math.floor(Math.random() * block.length)];
    }

    if (block && typeof block === "object") {
      for (const tenseKey of ["present", "past", "future"]) {
        const list = block[tenseKey];
        if (Array.isArray(list) && list.length) {
          return list[Math.floor(Math.random() * list.length)];
        }
      }
    }
  }
  return fallbackQuestion();
}

function getRandomQuestion(theme, tense) {
  const list = getQuestionList(theme, tense);
  if (list.length) {
    return list[Math.floor(Math.random() * list.length)];
  }
  return getAnyQuestionFromBank();
}

function speakQuestion(text) {
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = speechLangForLanguage(state.language);
  u.rate = 0.95;
  const voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
  const want = u.lang.toLowerCase();
  const v =
    voices.find(x => (x.lang || "").toLowerCase() === want) ||
    voices.find(x => (x.lang || "").toLowerCase().startsWith(want.slice(0, 2)));
  if (v) u.voice = v;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

let mediaRecorder = null;
let audioChunks = [];
let recordTimeout = null;
let silenceInterval = null;
let audioContext = null;
let analyser = null;
let micSource = null;
let audioStream = null;
let recordStartedAt = 0;

const MAX_RECORDING_MS = 9000;
const MIN_RECORDING_MS = 2200;
const SILENCE_GRACE_MS = 1600;
const SILENCE_THRESHOLD = 0.018;

async function onRecord() {
  if (!recordBtn || !out) return;

  if (state.lastAudioUrl) {
    URL.revokeObjectURL(state.lastAudioUrl);
    state.lastAudioUrl = null;
  }

  out.classList.remove("hidden");
  out.innerHTML = `
    <div><strong>Dictation</strong></div>
    <div class="tiny">Recording… speak naturally. A short thinking pause is fine.</div>
  `;

  audioChunks = [];
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(audioStream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      cleanupRecordingWatchers();

      try {
        audioStream.getTracks().forEach(t => t.stop());
      } catch {}

      const blob = new Blob(audioChunks, {
        type: (audioChunks[0] && audioChunks[0].type) ? audioChunks[0].type : "audio/webm"
      });

      state.lastAudioUrl = URL.createObjectURL(blob);

      out.innerHTML = `
        <div><strong>Dictation</strong></div>
        <div class="tiny">Transcribing…</div>
      `;

      try {
        const data = await window.transcribeAudio(blob, state.language);
        const text = (data && data.text) ? String(data.text).trim() : "";
        if (!text) {
          out.innerHTML = `
            <div><strong>Dictation</strong></div>
            <div class="tiny">No speech detected. Try again, closer to the mic.</div>
          `;
          return;
        }
        setAnswerValue(text);
        out.classList.add("hidden");
      } catch {
        out.innerHTML = `
          <div><strong>Dictation</strong></div>
          <div class="tiny">Transcription failed. Try again.</div>
        `;
      }
    };

    mediaRecorder.start();
    recordStartedAt = Date.now();
    startSilenceWatcher(audioStream);

    recordTimeout = setTimeout(() => safeStopRecording(), MAX_RECORDING_MS);
    recordBtn.textContent = "⏹ Stop";
    recordBtn.onclick = () => safeStopRecording();
  } catch {
    cleanupRecordingWatchers();
    out.innerHTML = `
      <div><strong>Dictation</strong></div>
      <div class="tiny">Microphone permission denied or unavailable.</div>
    `;
  }
}

function startSilenceWatcher(stream) {
  cleanupRecordingWatchers(false);

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    micSource = audioContext.createMediaStreamSource(stream);
    micSource.connect(analyser);

    const buffer = new Uint8Array(analyser.fftSize);
    let silenceSince = null;

    silenceInterval = setInterval(() => {
      if (!analyser || !mediaRecorder || mediaRecorder.state === "inactive") return;

      analyser.getByteTimeDomainData(buffer);

      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const centered = (buffer[i] - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / buffer.length);
      const elapsed = Date.now() - recordStartedAt;

      if (rms > SILENCE_THRESHOLD) {
        silenceSince = null;
        return;
      }

      if (elapsed < MIN_RECORDING_MS) return;

      if (silenceSince === null) {
        silenceSince = Date.now();
        return;
      }

      if (Date.now() - silenceSince >= SILENCE_GRACE_MS) {
        safeStopRecording();
      }
    }, 200);
  } catch {}
}

function cleanupRecordingWatchers(closeContext = true) {
  try {
    if (recordTimeout) clearTimeout(recordTimeout);
  } catch {}
  recordTimeout = null;

  try {
    if (silenceInterval) clearInterval(silenceInterval);
  } catch {}
  silenceInterval = null;

  try {
    if (micSource) micSource.disconnect();
  } catch {}
  micSource = null;
  analyser = null;

  if (closeContext && audioContext) {
    try { audioContext.close(); } catch {}
  }
  audioContext = null;
}

function safeStopRecording() {
  cleanupRecordingWatchers();

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    try { mediaRecorder.stop(); } catch {}
  }

  if (recordBtn) {
    recordBtn.textContent = "🎙 Dictate";
    recordBtn.onclick = onRecord;
  }
}

function setAnswerValue(value) {
  state.allowProgrammaticInput = true;
  aEl.value = value;
  state.lastSafeValue = aEl.value;
  queueMicrotask(() => {
    state.allowProgrammaticInput = false;
    state.keyInputBudget = 0;
  });
}

function normaliseSimilarityText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñüäößç\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stringSimilarity(a, b) {
  const aa = normaliseSimilarityText(a);
  const bb = normaliseSimilarityText(b);

  if (!aa || !bb) return 0;
  if (aa === bb) return 1;

  const aWords = aa.split(" ");
  const bWords = bb.split(" ");
  const aSet = new Set(aWords);
  const bSet = new Set(bWords);

  let overlap = 0;
  aSet.forEach(word => {
    if (bSet.has(word)) overlap += 1;
  });

  const union = new Set([...aSet, ...bSet]).size || 1;
  const jaccard = overlap / union;
  const lengthRatio = Math.min(aa.length, bb.length) / Math.max(aa.length, bb.length);

  return (jaccard * 0.75) + (lengthRatio * 0.25);
}

function answerUsesCoachModel(answer, question) {
  if (!state.lastResult || !state.lastResult.model_answer) return false;

  const sameQuestion = normaliseSimilarityText(question) === normaliseSimilarityText(state.lastResult.question);
  if (!sameQuestion) return false;

  return stringSimilarity(answer, state.lastResult.model_answer) >= 0.72;
}

function starsFor(score100) {
  if (score100 >= 85) return 3;
  if (score100 >= 70) return 2;
  if (score100 >= 55) return 1;
  return 0;
}

function addTotalStars(n) {
  const cur = Number(localStorage.getItem(TOTAL_STARS_KEY) || 0);
  localStorage.setItem(TOTAL_STARS_KEY, String(cur + n));
}

function updateBest(theme, tense, stars) {
  const key = `oral_best_${theme}_${tense}`;
  const cur = Number(localStorage.getItem(key) || 0);
  if (stars > cur) localStorage.setItem(key, String(stars));
}

async function onSubmit(e) {
  if (e) e.preventDefault();

  const answer = aEl.value.trim();

  if (!answer) return;

  const validity = validateTargetLanguageAnswer(answer, state.language);

  if (!validity.ok) {
    out.classList.remove("hidden");
    out.innerHTML = `
      <div style="font-weight:900;font-size:1.1rem;margin-bottom:8px;">Target language only</div>
      <div style="margin-bottom:8px;">${escapeHtml(validity.message)}</div>
      <div class="tiny">No English, no keyboard smash, and no pasted text.</div>
    `;
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  if (recordBtn) recordBtn.disabled = true;

  out.classList.remove("hidden");
  out.innerHTML = `<div><strong>Thinking…</strong></div><div class="tiny">Checking your answer.</div>`;

  if (!window.classifyAnswer || typeof window.classifyAnswer !== "function") {
    out.innerHTML = `
      <div><strong>Error</strong></div>
      <div class="tiny">The Worker link is not available on this page.</div>
    `;
    if (submitBtn) submitBtn.disabled = false;
    if (recordBtn) recordBtn.disabled = false;
    return;
  }

  const currentQuestion = getPlainQuestionText();

  const payload = {
    mode: "jc_oral",
    language: state.language,
    theme: state.theme,
    tense: state.tense,
    question: currentQuestion,
    answer,
    history: state.history,
    turn: state.turn + 1,
    max_turns: MAX_TURNS,
    previous_model_answer: state.lastResult && state.lastResult.model_answer ? state.lastResult.model_answer : "",
    previous_question: state.lastResult && state.lastResult.question ? state.lastResult.question : "",
    previous_score: state.lastResult && Number.isFinite(state.lastResult.score) ? state.lastResult.score : null
  };

  let result;
  try {
    result = await window.classifyAnswer(payload);
  } catch {
    result = {
      score: 0,
      focus: "communication",
      feedback: "AI error — try again.",
      next_question: null,
      next_tense: state.tense,
      session_end: false
    };
  }

  let score = Number(result.score) || 0;
  const focus = (result.focus || "communication").toString();
  const reusedCoachModel = answerUsesCoachModel(answer, currentQuestion);

  if (reusedCoachModel) {
    const previousScore = state.lastResult && Number.isFinite(state.lastResult.score) ? state.lastResult.score : 0;
    score = Math.max(score, Math.min(100, Math.max(70, previousScore + 10)));
  }

  state.turn += 1;
  state.scores.push(score);
  state.focuses.push(focus);
  state.history.push({ q: currentQuestion, a: answer, tense: state.tense });

  const outOf10 = Math.max(0, Math.min(10, Math.round(score / 10)));
  const starCount = starsFor(score);
  const stars = "⭐".repeat(starCount);
  const prevScore = state.scores.length > 1 ? state.scores[state.scores.length - 2] : null;

  let progressLine = "";
  if (prevScore !== null) {
    if (score > prevScore) progressLine = `<div style="margin-bottom:10px;font-weight:800;">⬆️ Nice improvement.</div>`;
    else if (score < prevScore) progressLine = `<div style="margin-bottom:10px;font-weight:800;">↘️ A bit weaker this time.</div>`;
    else progressLine = `<div style="margin-bottom:10px;font-weight:800;">➡️ Steady. One small upgrade now.</div>`;
  }

  if (reusedCoachModel) {
    progressLine = `<div style="margin-bottom:10px;font-weight:800;">⬆️ Coach model used well.</div>` + progressLine;
  }

  let coachLine = "";
  if (outOf10 >= 8) {
    coachLine = "Strong answer. Don’t waste too much time chasing one extra mark here. Improve another area too.";
  } else if (outOf10 >= 6) {
    coachLine = "Good base. One clear fix will move this up.";
  } else {
    coachLine = "This is fixable. Add one clear detail and tighten the language.";
  }

  out.innerHTML = `
    <div style="font-weight:900;font-size:1.3rem;margin-bottom:6px;">${outOf10}/10 ${stars}</div>
    ${progressLine}
    <div style="margin-bottom:10px;"><strong>Main mark-losing issue:</strong> ${escapeHtml(focus)}</div>
    <div style="margin-bottom:10px;"><strong>Coach note:</strong> ${escapeHtml(coachLine)}</div>
    <div style="margin-bottom:12px;">${escapeHtml(result.feedback || "—").replace(/\n/g, "<br>")}</div>
    ${result.model_answer ? `<div style="margin-top:10px;"><strong>Model:</strong><br>${escapeHtml(result.model_answer).replace(/\n/g, "<br>")}</div>` : ""}
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
      <button id="nextBtn" type="button">Next</button>
      <button id="readFeedbackBtn" class="smallBtn" type="button">🔊 Read Question</button>
    </div>
  `;

  setTurn(Math.min(state.turn + 1, MAX_TURNS));

  const readFeedbackBtn = document.getElementById("readFeedbackBtn");
  if (readFeedbackBtn) {
    readFeedbackBtn.addEventListener("click", () => speakQuestion(getPlainQuestionText()));
  }

  state.lastResult = {
    question: currentQuestion,
    score,
    model_answer: result.model_answer || ""
  };

  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (result.session_end || state.turn >= MAX_TURNS) {
        renderSummary(result);
        return;
      }

      const nextTense = (result.next_tense || state.tense).toString();
      state.tense = ["past", "future", "present"].includes(nextTense) ? nextTense : state.tense;

      hidePill();

      if (result.next_question && String(result.next_question).trim()) {
        setQuestion(String(result.next_question).trim());
      } else {
        setQuestion(getRandomQuestion(state.theme, state.tense));
      }

      setAnswerValue("");
      out.classList.add("hidden");
      if (submitBtn) submitBtn.disabled = false;
      if (recordBtn) recordBtn.disabled = false;
    });
  }
}

function renderSummary(result) {
  const avg = Math.round(state.scores.reduce((a, b) => a + b, 0) / Math.max(1, state.scores.length));
  const sessionStars = starsFor(avg);
  addTotalStars(sessionStars);
  updateBest(state.theme, state.tense, sessionStars);

  const counts = {};
  state.focuses.forEach(f => {
    const k = (f || "").trim();
    if (!k) return;
    counts[k] = (counts[k] || 0) + 1;
  });

  let main = "—";
  let best = 0;
  Object.keys(counts).forEach(k => {
    if (counts[k] > best) {
      best = counts[k];
      main = k;
    }
  });

  const drills = Array.isArray(result?.drills) ? result.drills : [];
  const avg10 = Math.max(0, Math.min(10, Math.round(avg / 10)));

  out.classList.remove("hidden");
  out.innerHTML = `
    <h2 style="margin-top:0;">Session Complete</h2>
    <div style="font-weight:900;font-size:1.8rem;margin:8px 0;">${avg10}/10 ${"⭐".repeat(sessionStars)}</div>
    <div class="tiny">Turns: ${state.turn}/${MAX_TURNS}</div>
    <div style="margin-top:12px;"><strong>Your main mark-losing issue today:</strong> ${escapeHtml(main)}</div>
    <div style="margin-top:10px;"><strong>What to do next:</strong>
      <ul style="margin:8px 0 0 18px;">
        ${(drills.length ? drills : [
          "Add 1 reason or 1 small detail to each answer.",
          "Use one connector.",
          "Repeat the same theme and try to beat your last round."
        ]).map(d => `<li>${escapeHtml(String(d))}</li>`).join("")}
      </ul>
    </div>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
      <button id="againBtn" type="button">Play Again</button>
      <button id="homeBtn2" class="ghost" type="button">Back to Themes</button>
    </div>
  `;

  const againBtn = document.getElementById("againBtn");
  if (againBtn) {
    againBtn.addEventListener("click", () => {
      const keepTheme = state.theme;
      const keepTense = state.tense;
      const keepLanguage = state.language;
      state = {
        language: keepLanguage,
        theme: keepTheme,
        tense: keepTense,
        turn: 0,
        history: [],
        scores: [],
        focuses: [],
        lastAudioUrl: null,
        bank: state.bank,
        lastSafeValue: ""
      };
      hidePill();
      setTurn(1);
      aEl.value = "";
      out.classList.add("hidden");
      if (submitBtn) submitBtn.disabled = false;
      if (recordBtn) recordBtn.disabled = false;
      setQuestion(getRandomQuestion(state.theme, state.tense));
    });
  }

  const homeBtn2 = document.getElementById("homeBtn2");
  if (homeBtn2) {
    homeBtn2.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  if (submitBtn) submitBtn.disabled = true;
  if (recordBtn) recordBtn.disabled = false;
}

function validateTargetLanguageAnswer(answer, lang) {
  const s = String(answer || "").trim();
  const lower = s.toLowerCase();

  if (s.length < 3) {
    return { ok: false, message: "That is too short." };
  }

  if (!/[a-zA-ZÀ-ÿÄÖÜäöüßñÑçÇ]/.test(s)) {
    return { ok: false, message: "That does not look like a real answer." };
  }

  if (looksLikeKeyboardSmash(lower)) {
    return { ok: false, message: "That looks like keyboard smash, not a real answer." };
  }

  if (lang === "es" && looksEnglishNotSpanish(lower)) {
    return { ok: false, message: "Please answer in Spanish only." };
  }

  if (lang === "fr" && looksEnglishNotFrench(lower)) {
    return { ok: false, message: "Please answer in French only." };
  }

  if (lang === "de" && looksEnglishNotGerman(lower)) {
    return { ok: false, message: "Please answer in German only." };
  }

  if (lang === "es" && !hasSpanishSignal(lower)) {
    return { ok: false, message: "That does not look Spanish enough." };
  }

  if (lang === "fr" && !hasFrenchSignal(lower)) {
    return { ok: false, message: "That does not look French enough." };
  }

  if (lang === "de" && !hasGermanSignal(lower)) {
    return { ok: false, message: "That does not look German enough." };
  }

  return { ok: true, message: "" };
}

function looksLikeKeyboardSmash(s) {
  if (s.length >= 6 && !/[aeiouáéíóúàèìòùâêîôûäëïöüy]/i.test(s)) return true;
  if (/([a-záéíóúàèìòùâêîôûäëïöüß])\1\1/i.test(s)) return true;
  if (/^[a-z]{7,}$/i.test(s) && !/\s/.test(s) && !/[aeiouáéíóúàèìòùâêîôûäëïöü]/i.test(s)) return true;
  return false;
}

function looksEnglishNotSpanish(s) {
  const english = /\b(i|my|me|and|the|is|are|live|like|love|have|go|went|with|because|but|in|on|at|family|school|friend|friends)\b/;
  const spanish = /\b(yo|me|mi|mis|soy|es|son|tengo|vivo|estoy|voy|fui|porque|pero|con|mi familia|mis amigos|instituto|colegio|me gusta|también)\b|[ñáéíóúü]/;
  return english.test(s) && !spanish.test(s);
}

function looksEnglishNotFrench(s) {
  const english = /\b(i|my|me|and|the|is|are|live|like|love|have|go|went|with|because|but|in|on|at|family|school|friend|friends)\b/;
  const french = /\b(je|j'|moi|mon|ma|mes|suis|ai|habite|vais|parce que|mais|avec|famille|école|amis|j'aime|aussi|dans|c'est)\b|[àâçéèêëîïôùûüÿœ]/;
  return english.test(s) && !french.test(s);
}

function looksEnglishNotGerman(s) {
  const english = /\b(i|my|me|and|the|is|are|live|like|love|have|go|went|with|because|but|in|on|at|family|school|friend|friends)\b/;
  const german = /\b(ich|mein|meine|bin|habe|wohne|gehe|ging|weil|aber|mit|familie|schule|freunde|mag|auch|und|in der|zu hause)\b|[äöüß]/;
  return english.test(s) && !german.test(s);
}

function hasSpanishSignal(s) {
  return /\b(yo|me|mi|mis|soy|es|son|tengo|vivo|estoy|voy|fui|porque|pero|con|familia|amigos|instituto|colegio|me gusta|también|muy|en|de|un|una)\b|[ñáéíóúü]/.test(s);
}

function hasFrenchSignal(s) {
  return /\b(je|j'|moi|mon|ma|mes|suis|ai|habite|vais|parce que|mais|avec|famille|école|amis|j'aime|aussi|très|dans|de|un|une|le|la|les|c'est)\b|[àâçéèêëîïôùûüÿœ]/.test(s);
}

function hasGermanSignal(s) {
  return /\b(ich|mein|meine|bin|habe|wohne|gehe|ging|weil|aber|mit|familie|schule|freunde|mag|auch|sehr|und|ein|eine|der|die|das|zu hause)\b|[äöüß]/.test(s);
}

function lockInputDown(el) {
  if (!el) return;

  state.lastSafeValue = el.value || "";

  ["paste", "copy", "cut", "drop", "contextmenu"].forEach(evt => {
    el.addEventListener(evt, e => e.preventDefault());
  });

  document.addEventListener("copy", e => {
    if (document.activeElement === el) e.preventDefault();
  });

  document.addEventListener("cut", e => {
    if (document.activeElement === el) e.preventDefault();
  });

  el.addEventListener("beforeinput", e => {
    const blocked = [
      "insertFromPaste",
      "insertFromDrop",
      "deleteByCut",
      "historyUndo",
      "historyRedo",
      "insertReplacementText"
    ];
    if (blocked.includes(e.inputType)) e.preventDefault();
  });

  el.addEventListener("keydown", e => {
    const key = (e.key || "").toLowerCase();

    if ((e.ctrlKey || e.metaKey) && ["v", "c", "x", "a", "z", "y"].includes(key)) {
      e.preventDefault();
      return;
    }

    const countsAsDirectInput =
      key.length === 1 ||
      key === "backspace" ||
      key === "delete" ||
      key === "enter" ||
      key === " ";

    if (countsAsDirectInput) {
      state.keyInputBudget += 1;
    }
  });

  el.addEventListener("input", () => {
    if (state.allowProgrammaticInput) {
      state.lastSafeValue = el.value;
      return;
    }

    if (state.keyInputBudget <= 0) {
      el.value = state.lastSafeValue;
      return;
    }

    state.keyInputBudget = Math.max(0, state.keyInputBudget - 1);
    state.lastSafeValue = el.value;
  });

  el.addEventListener("selectstart", e => e.preventDefault());
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
