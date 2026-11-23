// POST /api/parse  { text, now?, timeZone? } → { tasks, source, ms, promptVersion }
// The AI parser, used only when the on-device parser isn't confident.
import { generateJson, json, rateLimited } from './_lib/ai';
import { PROMPT_VERSION, systemPrompt, toTasks } from './_lib/prompt';

export const config = { runtime: 'edge' };

const MAX_CHARS = 600;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (rateLimited(req, 20, 10 * 60_000)) return json({ error: 'Too many requests from you just now. Try again in a few minutes.' }, 429);

  let body: { text?: unknown; now?: unknown; timeZone?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Send JSON with a "text" field.' }, 400); }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return json({ error: 'Nothing to parse.' }, 400);
  if (text.length > MAX_CHARS) return json({ error: `Keep it under ${MAX_CHARS} characters.` }, 413);

  const now = typeof body.now === 'string' && !Number.isNaN(Date.parse(body.now)) ? new Date(body.now) : new Date();
  let timeZone = typeof body.timeZone === 'string' ? body.timeZone : 'Asia/Kolkata';
  try { new Intl.DateTimeFormat('en', { timeZone }); } catch { timeZone = 'Asia/Kolkata'; }

  try {
    const r = await generateJson(systemPrompt(now, timeZone), text, (raw) => toTasks(raw, now, timeZone));
    console.log(JSON.stringify({ route: 'parse', provider: r.provider, ms: r.ms, chars: text.length, tasks: r.data.length, prompt: PROMPT_VERSION }));
    return json({ tasks: r.data, source: r.provider, ms: r.ms, promptVersion: PROMPT_VERSION });
  } catch (e) {
    console.error(JSON.stringify({ route: 'parse', error: e instanceof Error ? e.message : String(e) }));
    return json({ error: 'The AI parser is busy or out of free quota right now. Your words were parsed on your device instead.' }, 503);
  }
}
