export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }

    if (request.method === "GET") {
      return new Response("AI Coach Worker Active", { headers: cors() });
    }

    if (url.pathname === "/transcribe") {
      const form = await request.formData();
      const audio = form.get("audio");
      if (!audio) return json({ text: "" });

      const fd = new FormData();
      fd.append("model", "whisper-1");
      fd.append("language", "es");
      fd.append("file", audio, "speech.webm");

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + env.OPENAI_API_KEY },
        body: fd
      });

      const data = await response.json();
      return json({ text: data.text || "" });
    }

    const payload = await request.json();
    const { mode = "", question = "", answer = "", tense = "present" } = payload;

    const prompt = mode === "jc_oral"
      ? buildJCPrompt({ question, answer, tense, payload })
      : buildLegacyLCPrompt({ question, answer, tense });

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content: mode === "jc_oral"
              ? "You are a friendly Junior Cycle Spanish oral examiner. Output only JSON."
              : "You are a friendly Spanish oral examiner. Output only JSON."
          },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await ai.json();
    const text = data?.choices?.[0]?.message?.content ?? "";

    try {
      return json(JSON.parse(text));
    } catch {
      return json({ score: 0, focus: "communication", feedback: "AI parsing issue" });
    }
  }
};

function buildJCPrompt({ question, answer, tense, payload }) {
  return `
You are examining a Junior Cycle student in Spanish who is giving a short oral presentation and answering follow-up questions about himself.

Tone:
- kind, calm, encouraging, realistic
- never sarcastic
- do not overpraise weak work
- if the student is already strong (80+), it is acceptable to say they are in a strong place and should not obsess over chasing one extra mark here if another topic needs more work

QUESTION
${question}

STUDENT ANSWER
${answer}

Chosen tense: ${tense}
Theme: ${payload.theme || "general"}
Turn: ${payload.turn || 1} of ${payload.max_turns || 5}

SCORING
Return a score out of 100, but think in Junior Cycle terms and then map it to 100.
Judge mainly:
- communication
- grammar accuracy
- vocabulary range
- appropriateness of development

IMPORTANT
- Do NOT default to "development" every time
- Development means one more reason, example, or concrete detail when needed. It does NOT mean endless extra detail.
- Short but accurate answers can still score well.
- Choose ONE main weakness only.

Main weakness must be one of:
grammar
tense
vocabulary
development
communication

BAND GUIDE
40–55 very hard to understand / many serious errors
55–65 simple but limited / accuracy problems
60–70 understandable, some support needed
70–80 good answer for this level
80–90 strong answer, convincing and mostly secure
90+ excellent for this level

FOLLOW-UP
Ask ONE natural follow-up in Spanish.
Keep it in tense: ${tense} unless the student answer clearly forces a shift.
Follow-up should suit a young learner talking about self, family, school, hobbies, holidays, or future plans.

FEEDBACK
Feedback must be in ENGLISH and must contain:
- one genuine positive
- the main weakness
- one short practical tip

Also provide:
- model_answer: one improved Spanish answer that is short, natural, and believable for this student level
- drills: 3 short practical next steps

Return ONLY JSON:
{
  "score": 0-100,
  "focus": "grammar | tense | vocabulary | development | communication",
  "feedback": "short friendly advice in English",
  "model_answer": "short improved Spanish example",
  "next_question": "natural follow-up in Spanish",
  "next_tense": "${tense}",
  "session_end": false,
  "drills": ["practice idea","practice idea","practice idea"]
}
`;
}

function buildLegacyLCPrompt({ question, answer, tense }) {
  return `
You are a Spanish Leaving Certificate oral examiner from Spain.

Your tone is friendly, calm and conversational.

You sometimes react briefly like a real examiner:

Ah, vale.
Entiendo.
Ah sí?
Interesante.
Muy bien.

Then ask ONE follow-up question.

--------------------------------

QUESTION
${question}

STUDENT ANSWER
${answer}

--------------------------------

IMPORTANT EXAMINER BEHAVIOUR

If the student answer is short or underdeveloped,
encourage them to expand by asking questions like:

¿Por qué?
¿Y por qué?
¿Puedes explicarlo un poco más?
¿Y por qué piensas eso?

If the answer already has development,
ask a natural follow-up related to the topic.

--------------------------------

SCORING

Evaluate:

communication
grammar accuracy
vocabulary range
development of ideas

Choose ONE main weakness costing marks.

It must be one of:

grammar
tense
vocabulary
development
communication

Do NOT always choose development.

--------------------------------

REALISTIC SCORE GUIDE

40–55 serious grammar/tense problems
55–65 limited vocabulary or clarity
60–70 understandable but short/simple
70–80 good answer
80–90 strong answer
90+ excellent

--------------------------------

FOLLOW UP

Follow-up must stay in tense: ${tense}

Examples:

¿Por qué?
¿Te gustó?
¿Con quién fuiste?
¿Puedes explicarlo un poco más?
¿Y qué hiciste exactamente?

--------------------------------

FEEDBACK

Feedback must be in ENGLISH.

Structure:

• one genuine positive
• the main weakness
• one short improvement tip

Also provide a short improved Spanish example.

--------------------------------

Return ONLY JSON:

{
"score": 0-100,
"focus": "grammar | tense | vocabulary | development | communication",
"feedback": "short friendly advice",
"model_answer": "better Spanish example",
"next_question": "natural examiner follow-up",
"next_tense": "${tense}",
"session_end": false,
"drills": ["practice idea","practice idea"]
}
`;
}

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
