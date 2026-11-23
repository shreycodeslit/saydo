// Scores the on-device parser against the test set and writes public/evals/device.json.
// Run: npm run eval
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseTasks } from '../src/core/parse';
import { CONFIDENCE_THRESHOLD } from '../src/core/router';
import { CASES, EVAL_NOW, EVAL_TZ, type EvalCase } from './cases';
import { HELDOUT } from './heldout';
import { scoreCase, summarize } from './score';

const ctx = { now: new Date(EVAL_NOW), timeZone: EVAL_TZ };
const run = (cases: EvalCase[]) => cases.map((c) => {
  const got = parseTasks(c.input, ctx);
  const confident = got.length > 0 && got.every((t) => t.confidence >= CONFIDENCE_THRESHOLD);
  return { score: scoreCase(c, got), confident };
});
const started = performance.now();
const rows = run(CASES);
const held = run(HELDOUT);
const ms = performance.now() - started;

const scores = rows.map((r) => r.score);
const confident = rows.filter((r) => r.confident);
const routing = {
  threshold: CONFIDENCE_THRESHOLD,
  handledOnDevice: Math.round((confident.length / rows.length) * 1000) / 10,
  accuracyWhenConfident: confident.length ? Math.round((confident.filter((r) => r.score.correct).length / confident.length) * 1000) / 10 : 0,
  sentToAi: rows.length - confident.length,
  missedButConfident: confident.filter((r) => !r.score.correct).map((r) => r.score.id),
};

const out = {
  parser: 'device', model: 'Rule-based parser (runs in the browser, free)', ranAt: new Date().toISOString(), now: EVAL_NOW,
  avgMsPerCase: Math.round((ms / rows.length) * 100) / 100,
  summary: summarize(scores), routing,
  cases: rows.map((r) => ({ ...r.score, confident: r.confident })),
  heldout: {
    summary: summarize(held.map((r) => r.score)),
    handledOnDevice: Math.round((held.filter((r) => r.confident).length / held.length) * 1000) / 10,
    accuracyWhenConfident: (() => { const c = held.filter((r) => r.confident); return c.length ? Math.round((c.filter((r) => r.score.correct).length / c.length) * 1000) / 10 : 0; })(),
    cases: held.map((r) => ({ ...r.score, confident: r.confident })),
  },
};
mkdirSync('public/evals', { recursive: true });
writeFileSync('public/evals/device.json', JSON.stringify(out, null, 1));

const s = out.summary;
console.log(`On-device parser: ${s.caseAccuracy}% of ${s.cases} cases fully right, ${s.taskAccuracy}% of ${s.tasks} tasks`);
console.log('Fields:', s.fields.map((f) => `${f.field} ${f.accuracy}%`).join(' · '));
console.log('Groups:', s.groups.map((g) => `${g.group} ${g.accuracy}%`).join(' · '));
console.log(`Routing: ${routing.handledOnDevice}% handled on device (${routing.accuracyWhenConfident}% right when confident), ${routing.sentToAi} sent to AI; confident but wrong: ${routing.missedButConfident.join(', ') || 'none'}`);
const hs = out.heldout;
console.log(`Held-out (never tuned on): ${hs.summary.caseAccuracy}% of ${hs.summary.cases} cases right; ${hs.handledOnDevice}% handled on device, ${hs.accuracyWhenConfident}% right when confident`);
if (process.argv.includes('--fails')) {
  for (const r of [...rows, ...(process.argv.includes('--heldout') ? held : [])].filter((x) => !x.score.correct)) {
    console.log(`\n#${r.score.id} [${r.score.group}] ${r.score.input}  (confident=${r.confident})`);
    for (const t of r.score.tasks) {
      const bad = Object.entries(t.fields).filter(([, v]) => !v).map(([k]) => k);
      if (bad.length) console.log(`   want ${JSON.stringify(t.expected)}\n   got  ${JSON.stringify(t.got && { title: t.got.title, due: t.got.due, time: t.got.time, repeat: t.got.repeat, priority: t.got.priority, confidence: t.got.confidence })}  ✗ ${bad.join(',')}`);
    }
    if (!r.score.countOk) console.log(`   task count: want ${r.score.tasks.length}, extra ${r.score.extra}`);
  }
}
