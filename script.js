// Turbo Me (up) — Theme → Tense → short oral conversation
// Worker route stays the same. This front end sends mode:"jc_oral" so a safe worker branch can be added without harming the older LC game.

const MAX_TURNS = 5;
const TOTAL_STARS_KEY = "oral_totalStars";

const THEME_LABEL = {
  yo:"Yo y mi personalidad",
  familia:"Mi familia",
  casa:"Mi casa y mi barrio",
  instituto:"Mi instituto",
  amigos:"Mis amigos",
  tiempo:"Tiempo libre",
  vacaciones:"Vacaciones y viajes",
  salud:"Deporte y salud",
  tecnologia:"Tecnología y redes",
  futuro:"Planes y futuro"
};

const TENSE_LABEL = { present:"Present", past:"Past", future:"Future" };

let state = {
  theme: localStorage.getItem("oral_theme") || "yo",
  tense: localStorage.getItem("oral_tense") || "present",
  startTense: localStorage.getItem("oral_tense") || "present",
  turn: 0,
  history: [],
  scores: [],
  focuses: [],
  lastAudioUrl: null
};

const qEl = document.getElementById("question");
const aEl = document.getElementById("answer");
const out = document.getElementById("out");
const pill = document.getElementById("pill");
const homeBtn = document.getElementById("homeBtn");
const readQBtn = document.getElementById("readQ");
const recordBtn = document.getElementById("recordBtn");
const submitBtn = document.getElementById("submitBtn");
const turnCounter = document.getElementById("turnCounter");

if (qEl && aEl) initPlay();

function initPlay(){
  pill.textContent = `${THEME_LABEL[state.theme] || "Tema"} · ${TENSE_LABEL[state.tense] || "Tense"}`;
  refreshTurnCounter();
  homeBtn.addEventListener("click", ()=> window.location.href="index.html");
  readQBtn.addEventListener("click", ()=> speakES(qEl.textContent));
  recordBtn.addEventListener("click", onRecord);
  submitBtn.addEventListener("click", onSubmit);
  loadQuestionForCurrentTense();
}

function refreshTurnCounter(){
  if(turnCounter) turnCounter.textContent = `Turn ${Math.min(state.turn + 1, MAX_TURNS)}/${MAX_TURNS}`;
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

async function getBank(){
  return await fetch("questions.json", { cache:"no-store" }).then(r=>r.json());
}

async function loadQuestionForCurrentTense(){
  try{
    const bank = await getBank();
    const list = (bank?.[state.theme]?.[state.tense]) || [];
    const used = new Set(state.history.map(h => h.q));
    const fresh = list.filter(q => !used.has(q));
    const source = fresh.length ? fresh : list;
    const q = source[Math.floor(Math.random()*Math.max(1, source.length))] || "¿Puedes hablar un poco de este tema?";
    qEl.textContent = q;
  }catch{
    qEl.textContent = "¿Puedes hablar un poco de este tema?";
  }
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
    <div class="tiny">Recording… speak naturally. It stops automatically.</div>
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
        aEl.value = text;
        out.classList.add("hidden");
      } catch {
        out.innerHTML = `
          <div><strong>Dictation</strong></div>
          <div class="tiny">Transcription failed. Try again.</div>
        `;
      }
    };

    mediaRecorder.start();
    recordTimeout = setTimeout(()=> safeStopRecording(), 7000);
    recordBtn.textContent = "⏹ Stop";
    recordBtn.onclick = ()=> safeStopRecording();
  }catch{
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

function toTen(score100){
  return Math.max(0, Math.min(10, Math.round(score100 / 10)));
}

function focusLabel(focus){
  const map = {
    grammar: "Grammar accuracy",
    tense: "Tense control",
    vocabulary: "Vocabulary range",
    development: "Development of answer",
    communication: "Communication"
  };
  return map[(focus || "").toLowerCase()] || (focus || "—");
}

function strategicNudge(score100, focus){
  if(score100 >= 80){
    return "You are already in a strong band. Do not waste too much time chasing one extra mark here if another area needs more attention.";
  }
  if((focus || "").toLowerCase() === "development"){
    return "Development here means one more reason or one more concrete detail — not endless talking.";
  }
  return "Win marks by fixing the main weakness first, then add one extra detail.";
}

async function onSubmit(){
  const answer = aEl.value.trim();
  if(!answer) return;

  submitBtn.disabled = true;
  recordBtn.disabled = true;
  out.classList.remove("hidden");
  out.innerHTML = "Thinking…";

  const payload = {
    mode: "jc_oral",
    task: "Turbo Me (up)",
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
  }catch{
    result = { score: 0, focus: "communication", feedback: "AI error — try again.", next_question: null, next_tense: state.tense, session_end: false };
  }

  const score = Number(result.score) || 0;
  const focus = (result.focus || "").toString();
  const score10 = toTen(score);

  state.turn += 1;
  state.scores.push(score);
  state.focuses.push(focus);
  state.history.push({ q: qEl.textContent, a: answer, tense: state.tense });
  refreshTurnCounter();

  const starCount = starsFor(score);
  const stars = "⭐".repeat(starCount) || "—";

  out.innerHTML = `
    <div class="scoreBig">${score10}/10</div>
    <div class="tiny">Worker score: ${score}/100 · Stars this turn: ${stars}</div>
    <div class="feedbackBlock"><strong>Main target:</strong> ${escapeHtml(focusLabel(focus))}</div>
    <div class="feedbackBlock">${escapeHtml(result.feedback || "—").replace(/
/g,"<br>")}</div>
    <div class="feedbackBlock"><strong>Game plan:</strong> ${escapeHtml(strategicNudge(score, focus))}</div>
    ${result.model_answer ? `<div class="feedbackBlock"><strong>Better Spanish model:</strong><br>${escapeHtml(result.model_answer).replace(/
/g,"<br>")}</div>` : ""}
    <div class="btnRow">
      <button id="nextBtn" type="button">Next</button>
      <button id="readFeedbackBtn" class="smallBtn" type="button">🔊 Read Q</button>
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

    if(result.next_question){
      qEl.textContent = String(result.next_question);
    } else {
      await loadQuestionForCurrentTense();
    }

    aEl.value = "";
    out.classList.add("hidden");
    submitBtn.disabled = false;
    recordBtn.disabled = false;
  });
}

function renderSummary(result){
  const avg100 = Math.round(state.scores.reduce((a,b)=>a+b,0) / Math.max(1,state.scores.length));
  const avg10 = toTen(avg100);
  const sessionStars = starsFor(avg100);

  addTotalStars(sessionStars);
  updateBest(state.theme, state.startTense, sessionStars);

  const counts = {};
  state.focuses.forEach(f=>{
    const k = (f || "").trim().toLowerCase();
    if(!k) return;
    counts[k] = (counts[k] || 0) + 1;
  });
  let main = "communication";
  let best = 0;
  Object.keys(counts).forEach(k=>{
    if(counts[k] > best){ best = counts[k]; main = k; }
  });

  const drills = Array.isArray(result?.drills) ? result.drills : [];

  out.classList.remove("hidden");
  out.innerHTML = `
    <h2 style="margin-top:0;">Session Complete</h2>
    <div class="scoreBig">${avg10}/10 ${"⭐".repeat(sessionStars)}</div>
    <div class="tiny">Turns: ${state.turn}/${MAX_TURNS} · Stored under ${TENSE_LABEL[state.startTense]}</div>
    <div class="feedbackBlock"><strong>Main mark-losing issue today:</strong> ${escapeHtml(focusLabel(main))}</div>
    <div class="feedbackBlock"><strong>Next move:</strong> ${escapeHtml(strategicNudge(avg100, main))}</div>
    <div class="feedbackBlock">
      <strong>What to do next:</strong>
      <ul>
        ${(drills.length ? drills : [
          "Answer in 2–3 clear sentences, not one-word replies.",
          "Add one reason with porque or porque es…",
          "Reuse this topic and aim to improve the same weak area next round."
        ]).map(d=>`<li>${escapeHtml(String(d))}</li>`).join("")}
      </ul>
    </div>
    <div class="btnRow">
      <button id="againBtn" type="button">Play Again</button>
      <button id="homeBtn2" class="ghost" type="button">Back to Topics</button>
    </div>
  `;

  document.getElementById("againBtn").addEventListener("click", ()=>{
    const keepTheme = state.theme;
    const keepTense = state.startTense;
    localStorage.setItem("oral_tense", keepTense);
    state = { theme: keepTheme, tense: keepTense, startTense: keepTense, turn:0, history:[], scores:[], focuses:[], lastAudioUrl:null };
    pill.textContent = `${THEME_LABEL[state.theme] || "Tema"} · ${TENSE_LABEL[state.tense] || "Tense"}`;
    refreshTurnCounter();
    aEl.value = "";
    out.classList.add("hidden");
    submitBtn.disabled = false;
    recordBtn.disabled = false;
    loadQuestionForCurrentTense();
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
