import { sameRule } from '../src/core/repeat';
import type { ParsedTask } from '../src/core/types';
import type { EvalCase, Expected } from './cases';

const STOP = new Set(['the', 'a', 'an', 'to', 'my', 'for', 'of', 'on', 'at', 'ko', 'ka', 'ki', 'ke', 'hai', 'and']);
const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)));

export function titleSimilarity(a: string, b: string): number {
  const x = tokens(a), y = tokens(b);
  if (!x.size && !y.size) return 1;
  let inter = 0; for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}

export interface FieldScore { title: boolean; due: boolean; time: boolean; repeat: boolean; priority: boolean }
export interface CaseScore { id: number; group: string; input: string; correct: boolean; countOk: boolean; tasks: { expected: Expected; got: ParsedTask | null; fields: FieldScore; correct: boolean }[]; extra: number }

export function scoreCase(c: EvalCase, got: ParsedTask[]): CaseScore {
  const left = [...got];
  const tasks = c.expected.map((exp) => {
    let best = -1, bestSim = -1;
    left.forEach((g, i) => { const s = titleSimilarity(exp.title, g.title); if (s > bestSim) { bestSim = s; best = i; } });
    const g = best >= 0 ? left.splice(best, 1)[0] : null;
    const fields: FieldScore = {
      title: !!g && titleSimilarity(exp.title, g.title) >= 0.5,
      due: !!g && (exp.due ?? null) === (g.due ?? null),
      time: !!g && (exp.time ?? null) === (g.time ?? null),
      repeat: !!g && sameRule(exp.repeat ?? null, g.repeat ?? null),
      priority: !!g && (exp.priority ?? 'normal') === (g.priority ?? 'normal'),
    };
    return { expected: exp, got: g, fields, correct: Object.values(fields).every(Boolean) };
  });
  const countOk = got.length === c.expected.length;
  return { id: c.id, group: c.group, input: c.input, tasks, extra: left.length, countOk, correct: countOk && tasks.every((t) => t.correct) };
}

export function summarize(scores: CaseScore[]) {
  const allTasks = scores.flatMap((s) => s.tasks);
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
  const fields = (['title', 'due', 'time', 'repeat', 'priority'] as const).map((f) => ({ field: f, accuracy: pct(allTasks.filter((t) => t.fields[f]).length, allTasks.length) }));
  const groups = [...new Set(scores.map((s) => s.group))].map((g) => {
    const gs = scores.filter((s) => s.group === g);
    return { group: g, cases: gs.length, accuracy: pct(gs.filter((s) => s.correct).length, gs.length) };
  });
  return {
    cases: scores.length,
    tasks: allTasks.length,
    caseAccuracy: pct(scores.filter((s) => s.correct).length, scores.length),
    taskAccuracy: pct(allTasks.filter((t) => t.correct).length, allTasks.length),
    fields,
    groups,
  };
}
