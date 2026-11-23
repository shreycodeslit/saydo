// GET /api/status → which free AI services are configured (never the keys themselves)
// GET /api/status?check=1 → also sends a tiny test request to each provider and reports any error message
import { generateJson, json } from './_lib/ai';

declare const process: { env: Record<string, string | undefined> };
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const out: Record<string, unknown> = { ai: !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY), speech: !!process.env.GROQ_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-flash-latest' };
  if (new URL(req.url).searchParams.get('check') === '1') {
    try {
      const r = await generateJson('Reply with JSON {"ok": true}.', 'ping', (raw) => raw);
      out.check = { provider: r.provider, ms: r.ms, earlierFailures: r.skipped };
    } catch (e) { out.check = { error: e instanceof Error ? e.message : String(e) }; }
  }
  return json(out);
}
