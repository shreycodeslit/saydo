// Scores the AI parser (the deployed /api/parse) against both test sets and writes public/evals/ai.json.
// Run: npm run eval:ai -- https://your-app.vercel.app
// Requests are spaced out to stay inside the free-tier limits, so a full run takes about 15 minutes.
import { writeFileSync } from 'node:fs';
import { CASES, EVAL_NOW, EVAL_TZ } from './cases';
import { HELDOUT } from './heldout';
import { scoreCase, summarize } from './score';
import type { ParsedTask } from '../src/core/types';

const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) { console.error('Usage: npm run eval:ai -- https://your-app.vercel.app'); process.exit(1); }
const GAP_MS = Number(process.env.EVAL_GAP_MS || 6500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ask(text: string): Promise<{ tasks: ParsedTask[]; source: string; ms: number }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${base}/api/parse`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, now: EVAL_NOW, timeZone: EVAL_TZ }) });
    if (res.ok) return res.json();
    await sleep(GAP_MS * (attempt + 2));
  }
  return { tasks: [], source: 'failed', ms: 0 };
}

const results: Record<number, { tasks: ParsedTask[]; source: string; ms: number }> = {};
for (const c of [...CASES, ...HELDOUT]) {
  results[c.id] = await ask(c.input);
  process.stdout.write(`${c.id} `);
  await sleep(GAP_MS);
}
const main = CASES.map((c) => scoreCase(c, results[c.id].tasks));
const held = HELDOUT.map((c) => scoreCase(c, results[c.id].tasks));
const used = Object.values(results).map((r) => r.source);
const out = {
  parser: 'ai', model: used.filter((s) => s === 'gemini').length >= used.length / 2 ? 'Gemini Flash, free tier' : 'Groq, free tier',
  ranAt: new Date().toISOString(), now: EVAL_NOW,
  avgMs: Math.round(Object.values(results).reduce((a, r) => a + r.ms, 0) / used.length),
  providers: Object.fromEntries([...new Set(used)].map((s) => [s, used.filter((x) => x === s).length])),
  summary: summarize(main), cases: main,
  heldout: { summary: summarize(held), cases: held },
};
writeFileSync('public/evals/ai.json', JSON.stringify(out, null, 1));
console.log(`\nAI parser: ${out.summary.caseAccuracy}% of ${out.summary.cases} cases, unseen set ${out.heldout.summary.caseAccuracy}%`);
