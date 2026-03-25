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

let state = {
  language: localStorage.getItem("oral_language") || "es",
  theme: localStorage.getItem("oral_theme") || "yo",
  tense: localStorage.getItem("oral_tense") || "present",
  turn: 0,
  history: [],
  scores: [],
  focuses: [],
  lastAudioUrl: null,
  bank: null
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
  blockCopyPaste(aEl);

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
      speakQuestion(qEl.textContent);
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

function setQuestion(text) {
  qEl.textContent = text || fallbackQuestion();
}

function fallbackQuestion() {
  if (state.language === "fr") return "Peux-tu parler un peu de ce thème ?";
  if (state.language === "de") return "Kannst du ein bisschen über dieses Thema sprechen?";
  return "¿Puedes hablar un poco de este tema?";
}

async function loadBank() {
  if (state.bank) return state.bank;
  try {
    const file = questionFileForLanguage(state.language);
    state.bank = await fetch(file, { cache: "no-store" }).then(r => r.json());
  } catch {
    state.bank = {};
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
    voices.find(x => (x.lang || "").toLowerCase().startsWith(want.slice(0,2)));
  if (v) u.voice = v;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

let mediaRecorder = null;
let audioChunks = [];
let recordTimeout = null;

async function onRecord() {
  if (!recordBtn || !out) return;

  if (state.lastAudioUrl) {
    URL.revokeObjectURL(state.lastAudioUrl);
    state.lastAudioUrl = null;
  }

  out.classList.remove("hidden");
  out.innerHTML = `
    <div><strong>Dictation</strong></div>
    <div class="tiny">Recording… speak naturally. (Stops automatically.)</div>
  `;

  audioChunks = [];
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      try {
        stream.getTracks().forEach(t => t.stop());
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
        aEl.value = (aEl.value.trim() ? (aEl.value.trim() + " ") : "") + text;
        out.classList.add("hidden");
      } catch {
        out.innerHTML = `
          <div><strong>Dictation</strong></div>
          <div class="tiny">Transcription failed. Try again.</div>
        `;
      }
    };

    mediaRecorder.start();
    recordTimeout = setTimeout(() => safeStopRecording(), 6000);
    recordBtn.textContent = "⏹ Stop";
    recordBtn.onclick = () => safeStopRecording();
  } catch {
    out.innerHTML = `
      <div><strong>Dictation</strong></div>
      <div class="tiny">Microphone permission denied or unavailable.</div>
    `;
  }
}

function safeStopRecording() {
  try {
    if (recordTimeout) clearTimeout(recordTimeout);
  } catch {}

  recordTimeout = null;

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    try { mediaRecorder.stop(); } catch {}
  }

  if (recordBtn) {
    recordBtn.textContent = "🎙 Dictate";
    recordBtn.onclick = onRecord;
  }
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

  const payload = {
    mode: "lc_oral",
    language: state.language,
    theme: state.theme,
    tense: state.tense,
    question: qEl.textContent,
    answer,
    history: state.history,
    turn: state.turn + 1,
    max_turns: MAX_TURNS
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

  const score = Number(result.score) || 0;
  const focus = (result.focus || "communication").toString();

  state.turn += 1;
  state.scores.push(score);
  state.focuses.push(focus);
  state.history.push({ q: qEl.textContent, a: answer, tense: state.tense });

  const outOf10 = Math.max(0, Math.min(10, Math.round(score / 10)));
  const starCount = starsFor(score);
  const stars = "⭐".repeat(starCount);
  const prevScore = state.scores.length > 1 ? state.scores[state.scores.length - 2] : null;

  let progressLine = "";
  if (prevScore !== null) {
    if (score > prevScore) progressLine = `<div style="margin-bottom:10px;font-weight:800;">⬆️ Nice improvement.</div>`;
    else if (score < prevScore) progressLine = `<div style="margin-bottom:10px;font-weight:800;">⚠️ A bit weaker this time — something is lacking.</div>`;
    else progressLine = `<div style="margin-bottom:10px;font-weight:800;">➡️ Steady. One small upgrade now.</div>`;
  }

  let coachLine = "";
  if (outOf10 >= 8) {
    coachLine = "Strong answer. Don’t waste too much time chasing one extra mark here. Improve another area too.";
  } else if (outOf10 >= 6) {
    coachLine = "Good base. One clear fix will move this up.";
  } else {
    coachLine = "Something important is lacking, but it is very fixable.";
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
    readFeedbackBtn.addEventListener("click", () => speakQuestion(qEl.textContent));
  }

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

      aEl.value = "";
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
        bank: state.bank
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

function blockCopyPaste(el) {
  if (!el) return;

  ["paste", "copy", "cut", "drop"].forEach(evt => {
    el.addEventListener(evt, e => e.preventDefault());
  });

  el.addEventListener("keydown", e => {
    const key = (e.key || "").toLowerCase();
    if ((e.ctrlKey || e.metaKey) && ["v", "c", "x"].includes(key)) {
      e.preventDefault();
    }
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
