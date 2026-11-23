// Decides who parses each request: the free on-device parser when it is confident,
// otherwise the AI parser on the server (Gemini free tier, Groq as backup).
import { parseTasks, type ParseContext } from './parse';
import type { ParsedTask, ParseResult, ParseSource } from './types';

export const CONFIDENCE_THRESHOLD = 0.7;

export function needsAi(tasks: ParsedTask[]): boolean {
  return tasks.length === 0 || tasks.some((t) => t.confidence < CONFIDENCE_THRESHOLD);
}

export async function parseSmart(text: string, ctx: ParseContext, opts: { forceAi?: boolean; signal?: AbortSignal } = {}): Promise<ParseResult & { fallback?: string }> {
  const t0 = performance.now();
  const local = parseTasks(text, ctx);
  if (!opts.forceAi && !needsAi(local)) return { tasks: local, source: 'device', ms: Math.round(performance.now() - t0) };
  try {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, now: ctx.now.toISOString(), timeZone: ctx.timeZone }),
      signal: opts.signal,
    });
    const data = await res.json();
    if (!res.ok || data?.error) throw new Error(data?.error || `AI parser returned ${res.status}`);
    return { tasks: data.tasks as ParsedTask[], source: data.source as ParseSource, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    // No network, quota used up or rate limited: keep the on-device result and say so
    return { tasks: local, source: 'device', ms: Math.round(performance.now() - t0), fallback: e instanceof Error ? e.message : 'AI parser unavailable' };
  }
}
