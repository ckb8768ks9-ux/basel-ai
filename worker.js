// Basel AI - deployment
const ALLOWED_ORIGIN = "https://ckb8768ks9-ux.github.io";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=utf-8"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "POST") {
      return Response.json(
        { error: "Use POST to chat with Basel." },
        { status: 405, headers }
      );
    }

    if (origin !== ALLOWED_ORIGIN) {
      return Response.json(
        { error: "Origin not allowed." },
        { status: 403, headers }
      );
    }

    if (!env.GEMINI_API_KEY) {
      return Response.json(
        { error: "Gemini API key is not configured." },
        { status: 500, headers }
      );
    }

    try {
      const body = await request.json();
      const messages = Array.isArray(body.messages)
        ? body.messages.slice(-12)
        : [];

      const contents = messages
        .filter(m => typeof m.content === "string")
        .map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content.slice(0, 6000) }]
        }));

      if (!contents.length) {
        return Response.json(
          { error: "No message provided." },
          { status: 400, headers }
        );
      }

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: "أنت باسل BASEL، مساعد ذكاء اصطناعي شخصي. هويتك ثابتة، صريح ودافئ وفضولي، وتوضح أنك ذكاء اصطناعي لا إنسان. تتحدث بالعربية أو الإنجليزية حسب المستخدم. ساعد في التفكير والتخطيط والمشاريع، ولا تدّعِ تنفيذ أعمال لم تنفذها."
              }]
            },
            contents,
            generationConfig: {
              maxOutputTokens: 1024
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return Response.json(
          { error: "AI service unavailable", status: response.status },
          { status: 502, headers }
        );
      }

      const reply = data.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "").join("") || "";

      return Response.json({ reply }, { headers });
    } catch {
      return Response.json(
        { error: "Unable to process request." },
        { status: 400, headers }
      );
    }
  }
};
