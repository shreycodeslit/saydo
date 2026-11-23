// POST /api/transcribe (multipart: audio, lang?) → { text }
// Speech to text for browsers without built-in speech recognition (e.g. Firefox), via Groq's free Whisper.
import { json, rateLimited, transcribe } from './_lib/ai';

export const config = { runtime: 'edge' };

const MAX_BYTES = 3 * 1024 * 1024;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (rateLimited(req, 15, 10 * 60_000)) return json({ error: 'Too many recordings just now. Try again in a few minutes.' }, 429);
  try {
    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof Blob) || audio.size === 0) return json({ error: 'No audio received.' }, 400);
    if (audio.size > MAX_BYTES) return json({ error: 'Recording is too long. Keep it under a minute.' }, 413);
    const lang = form.get('lang');
    const text = await transcribe(audio, typeof lang === 'string' && /^[a-z]{2}$/.test(lang) ? lang : undefined);
    return json({ text });
  } catch (e) {
    console.error(JSON.stringify({ route: 'transcribe', error: e instanceof Error ? e.message : String(e) }));
    return json({ error: 'Speech-to-text is unavailable right now. You can type instead.' }, 503);
  }
}
