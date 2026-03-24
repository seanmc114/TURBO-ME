// ai.js — SAFE AI BRIDGE (Cloudflare Worker)
// Keep the same base URL you already use.
const WORKER_BASE = "https://royal-butterfly-00d8.seansynge.workers.dev";

// Evaluate (JSON -> JSON)
async function classifyAnswer(payload) {
  const res = await fetch(WORKER_BASE + "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("AI request failed");
  return await res.json();
}

// Transcribe (audio -> {text})
async function transcribeAudio(blob) {
  const fd = new FormData();
  // Use a filename and type; many APIs rely on this.
  fd.append("audio", blob, "speech.webm");

  const res = await fetch(WORKER_BASE + "/transcribe", {
    method: "POST",
    body: fd
  });
  if (!res.ok) throw new Error("Transcription failed");
  return await res.json();
}

window.classifyAnswer = classifyAnswer;
window.transcribeAudio = transcribeAudio;
