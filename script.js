const MAX_TURNS = 3;
const TOTAL_STARS_KEY = "oral_totalStars";

const THEME_LABEL = {
  yo:"Yo y mi personalidad",
  barrio:"Mi barrio y mi casa",
  instituto:"Mi instituto",
  familia:"Mi familia",
  amigos:"Mis amigos",
  tiempo:"Tiempo libre",
  vacaciones:"Vacaciones y viajes",
  salud:"Deporte y salud",
  tecnologia:"Tecnología y redes",
  comida:"Comida y vida diaria",
  futuro:"Planes y futuro"
};

const TENSE_LABEL = { present:"Present", past:"Past", future:"Future" };

let state = {
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

if (qEl && aEl) initPlay();

async function initPlay(){
  pill.textContent = `${THEME_LABEL[state.theme] || "Tema"} · ${TENSE_LABEL[state.tense] || "Tense"}`;
  homeBtn.addEventListener("click", ()=> window.location.href="index.html");
  readQBtn.addEventListener("click", ()=> speakES(qEl.textContent));
  recordBtn.addEventListener("click", onRecord);
  submitBtn.addEventListener("click", onSubmit);
  qEl.textContent = "Loading question…";
  await loadBank();
  setQuestion(getRandomQuestion(state.theme, state.tense));
}

function setQuestion(text){
  qEl.textContent = text || "¿Puedes hablar un poco de este tema?";
}

async function loadBank(){
  if (state.bank) return state.bank;
  try {
    state.bank = await fetch("questions.json", { cache:"no-store" }).then(r => r.json());
  } catch {
    state.bank = {};
  }
  return state.bank;
}

function getRandomQuestion(theme, tense){
  const list = state.bank?.[theme]?.[tense];
  if (Array.isArray(list) && list.length) {
    return list[Math.floor(Math.random() * list.length)];
  }
  return "¿Puedes hablar un poco de este tema?";
}

function speakES(text){
  if(!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = 0.95;
  const voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
  const v = voices.find(x => (x.lang||"").toLowerCase()==="es-es") || voices.find(x => (x.lang||"").toLowerCase().startsWith("es"));
  if(v) u.voice = v;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

let mediaRecorder = null;
let audioChunks = [];
let recordTimeout = null;

async function onRecord(){
  if(state.lastAudioUrl){
    URL.revokeObjectURL(state.lastAudioUrl);
    state.lastAudioUrl = null;
  }

  out.classList.remove("hidden");
  out.innerHTML = `
    <div><strong>Dictation</strong></div>
    <div class="tiny">Recording… speak naturally. (Stops automatically.)</div>
  `;

  audioChunks = [];
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e)=>{ if(e.data && e.data.size) audioChunks.push(e.data); };

    mediaRecorder.onstop = async ()=>{
      try{ stream.getTracks().forEach(t=>t.stop()); } catch {}
      const blob = new Blob(audioChunks, { type: (audioChunks[0] && audioChunks[0].type) ? audioChunks[0].type : "audio/webm" });
      state.lastAudioUrl = URL.createObjectURL(blob);

      out.innerHTML = `
        <div><strong>Dictation</strong></div>
        <div class="tiny">Transcribing…</div>
      `;

      try{
        const data = await window.transcribeAudio(blob);
        const text = (data && data.text) ? String(data.text).trim() : "";
        if(!text){
          out.innerHTML = `
            <div><strong>Dictation</strong></div>
            <div class="tiny">No speech detected. Try again, closer to the mic.</div>
          `;
          return;
        }
        aEl.value = (aEl.value.trim() ? (aEl.value.trim()+" ") : "") + text;
        out.classList.add("hidden");
      } catch {
        out.innerHTML = `
          <div><strong>Dictation</strong></div>
          <div class="tiny">Transcription failed. Try again.</div>
        `;
      }
    };

    mediaRecorder.start();
    recordTimeout = setTimeout(()=> safeStopRecording(), 6000);
    recordBtn.textContent = "⏹ Stop";
    recordBtn.onclick = ()=> safeStopRecording();
  } catch {
    out.innerHTML = `
      <div><strong>Dictation</strong></div>
      <div class="tiny">Microphone permission denied or unavailable.</div>
    `;
  }
}

function safeStopRecording(){
  try{ if(recordTimeout) clearTimeout(recordTimeout); } catch {}
  recordTimeout = null;
  if(mediaRecorder && mediaRecorder.state !== "inactive"){
    try{ mediaRecorder.stop(); } catch {}
  }
  recordBtn.textContent = "🎙 Dictate";
  recordBtn.onclick = onRecord;
}

function starsFor(score100){
  if(score100 >= 85) return 3;
  if(score100 >= 70) return 2;
  if(score100 >= 55) return 1;
  return 0;
}

function addTotalStars(n){
  const cur = Number(localStorage.getItem(TOTAL_STARS_KEY) || 0);
  localStorage.setItem(TOTAL_STARS_KEY, String(cur + n));
}

function updateBest(theme, tense, stars){
  const key = `oral_best_${theme}_${tense}`;
  const cur = Number(localStorage.getItem(key) || 0);
  if(stars > cur) localStorage.setItem(key, String(stars));
}

async function onSubmit(){
  const answer = aEl.value.trim();
  if(!answer) return;

  submitBtn.disabled = true;
  recordBtn.disabled = true;
  out.classList.remove("hidden");
  out.innerHTML = "Thinking…";

  const payload = {
    mode: "lc_oral",
    theme: state.theme,
    tense: state.tense,
    question: qEl.textContent,
    answer,
    history: state.history,
    turn: state.turn + 1,
    max_turns: MAX_TURNS
  };

  let result;
  try{
    result = await window.classifyAnswer(payload);
  } catch {
    result = { score: 0, focus: "communication", feedback: "AI error — try again.", next_question: null, next_tense: state.tense, session_end: false };
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
    <div style="margin-bottom:12px;">${escapeHtml(result.feedback || "—").replace(/\n/g,"<br>")}</div>
    ${result.model_answer ? `<div style="margin-top:10px;"><strong>Model (Spanish):</strong><br>${escapeHtml(result.model_answer).replace(/\n/g,"<br>")}</div>` : ""}
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
      <button id="nextBtn" type="button">Next</button>
      <button id="readFeedbackBtn" class="smallBtn" type="button">🔊 Read Question</button>
    </div>
  `;

  document.getElementById("readFeedbackBtn").addEventListener("click", ()=> speakES(qEl.textContent));

  document.getElementById("nextBtn").addEventListener("click", async ()=>{
    if(result.session_end || state.turn >= MAX_TURNS){
      renderSummary(result);
      return;
    }

    const nextTense = (result.next_tense || state.tense).toString();
    state.tense = (nextTense === "past" || nextTense === "future" || nextTense === "present") ? nextTense : state.tense;
    pill.textContent = `${THEME_LABEL[state.theme] || "Tema"} · ${TENSE_LABEL[state.tense] || "Tense"}`;

    if(result.next_question && String(result.next_question).trim()) setQuestion(String(result.next_question).trim());
    else setQuestion(getRandomQuestion(state.theme, state.tense));

    aEl.value = "";
    out.classList.add("hidden");
    submitBtn.disabled = false;
    recordBtn.disabled = false;
  });
}

function renderSummary(result){
  const avg = Math.round(state.scores.reduce((a,b)=>a+b,0) / Math.max(1,state.scores.length));
  const sessionStars = starsFor(avg);
  addTotalStars(sessionStars);
  updateBest(state.theme, state.tense, sessionStars);

  const counts = {};
  state.focuses.forEach(f=>{
    const k = (f || "").trim();
    if(!k) return;
    counts[k] = (counts[k] || 0) + 1;
  });

  let main = "—";
  let best = 0;
  Object.keys(counts).forEach(k=>{
    if(counts[k] > best){ best = counts[k]; main = k; }
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
        ${(drills.length ? drills : ["Add 1 reason (porque) or 1 small detail to each answer.", "Use one connector: además / también / sin embargo.", "Repeat the same theme and try to beat your last round."]).map(d=>`<li>${escapeHtml(String(d))}</li>`).join("")}
      </ul>
    </div>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
      <button id="againBtn" type="button">Play Again</button>
      <button id="homeBtn2" class="ghost" type="button">Back to Themes</button>
    </div>
  `;

  document.getElementById("againBtn").addEventListener("click", ()=>{
    const keepTheme = state.theme;
    const keepTense = state.tense;
    state = { theme: keepTheme, tense: keepTense, turn: 0, history: [], scores: [], focuses: [], lastAudioUrl: null, bank: state.bank };
    pill.textContent = `${THEME_LABEL[state.theme] || "Tema"} · ${TENSE_LABEL[state.tense] || "Tense"}`;
    aEl.value = "";
    out.classList.add("hidden");
    submitBtn.disabled = false;
    recordBtn.disabled = false;
    setQuestion(getRandomQuestion(state.theme, state.tense));
  });

  document.getElementById("homeBtn2").addEventListener("click", ()=> window.location.href="index.html");
  submitBtn.disabled = true;
  recordBtn.disabled = false;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
