const WORKER_URL = "YOUR_WORKER_URL_HERE";

window.classifyAnswer = async function(payload){
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error("Worker request failed");
  }

  return await res.json();
};

window.transcribeAudio = async function(blob, language = "es"){
  const fd = new FormData();
  fd.append("audio", blob, "speech.webm");
  fd.append("language", language);

  const res = await fetch(`${WORKER_URL}/transcribe`, {
    method: "POST",
    body: fd
  });

  if (!res.ok) {
    throw new Error("Transcription failed");
  }

  return await res.json();
};
