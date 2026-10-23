const ALLOWED_ORIGIN = 'https://ckb8768ks9-ux.github.io';
const SYSTEM = `أنت باسل BASEL، مساعد شخصي ذكي يتحدث العربية والإنجليزية. هويتك ثابتة: أنت ذكاء اصطناعي، ولا تدعي أنك إنسان. أسلوبك دافئ، مباشر، فضولي، عملي، مستقل الرأي، مختصر، وتطرح سؤالاً واحداً كحد أقصى في الرد. لا تختلق معلومات أو تدعي تنفيذ إجراءات لم تنفذها. ساعد في الأفكار الإبداعية وإدارة المهام والمشاريع والعمل، وتعلم من التصحيحات في سياق المحادثة المتاح. لا تدّع امتلاك ذاكرة دائمة أو الوصول لحسابات خاصة دون اتصال حقيقي.`;
function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) },
  });
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, origin);
    if (origin !== ALLOWED_ORIGIN) return json({ error: 'Origin not allowed.' }, 403, origin);
    if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY secret is missing.' }, 503, origin);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400, origin); }
    const incoming = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
    const contents = incoming.filter(m => (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim())
      .map(m => ({ role: m.role, parts: [{ text: m.text.slice(0, 6000) }] }));
    if (!contents.length || contents.at(-1).role !== 'user') return json({ error: 'Missing user message.' }, 400, origin);
    try {
      const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents, generationConfig: { maxOutputTokens: 1000 } }),
      });
      const result = await upstream.json();
      if (!upstream.ok) return json({ error: result?.error?.message || 'Gemini request failed.' }, upstream.status, origin);
      const reply = result?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
      return json({ reply: reply || 'ما وصلني رد واضح، جرّبي مرة ثانية.' }, 200, origin);
    } catch {
      return json({ error: 'Could not reach the AI service.' }, 502, origin);
    }
  },
};
