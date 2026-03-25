const WORKER_URL = "https://royal-butterfly-00d8.seansynge.workers.dev";

window.classifyAnswer = async function (payload) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("Worker HTTP error:", res.status, text);
    throw new Error("Worker request failed");
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Worker JSON parse error:", text);
    throw new Error("Worker returned invalid JSON");
  }
};

window.transcribeAudio = async function (blob, language = "es") {
  const fd = new FormData();
  fd.append("audio", blob, "speech.webm");
  fd.append("language", language);

  const res = await fetch(`${WORKER_URL}/transcribe`, {
    method: "POST",
    body: fd
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("Transcribe HTTP error:", res.status, text);
    throw new Error("Transcription failed");
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Transcribe JSON parse error:", text);
    throw new Error("Transcription returned invalid JSON");
  }
};
