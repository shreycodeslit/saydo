// GET /api/status → which free AI services are configured (never the keys themselves)
import { json } from './_lib/ai';

declare const process: { env: Record<string, string | undefined> };
export const config = { runtime: 'edge' };

export default function handler(): Response {
  return json({ ai: !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY), speech: !!process.env.GROQ_API_KEY });
}
