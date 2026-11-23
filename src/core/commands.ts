// Voice commands for the existing list: "what's on today?", "mark milk done", "move the bill to Friday".
// Anything that isn't clearly a command about an existing task is treated as new tasks.
import { parseTasks, type ParseContext } from './parse';
import type { SavedTask } from './types';

export type Range = 'today' | 'tomorrow' | 'week' | 'overdue' | 'all';
export type Command =
  | { kind: 'query'; range: Range }
  | { kind: 'briefing' }
  | { kind: 'complete'; task: SavedTask }
  | { kind: 'move'; task: SavedTask; due: string | null; time: string | null }
  | { kind: 'delete'; task: SavedTask };

const STOP = new Set(['the', 'a', 'an', 'my', 'to', 'task', 'ka', 'ki', 'ko', 'wala', 'wali']);
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));

export function findTask(name: string, tasks: SavedTask[], min = 0.4): SavedTask | null {
  const q = new Set(words(name));
  if (!q.size) return null;
  let best: SavedTask | null = null, bestScore = 0;
  for (const t of tasks) {
    if (t.done) continue;
    const w = new Set(words(t.title));
    let hit = 0; for (const x of q) if (w.has(x)) hit++;
    const score = hit / q.size * 0.7 + hit / Math.max(1, w.size) * 0.3;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return bestScore >= min ? best : null;
}

export function detectCommand(input: string, tasks: SavedTask[], ctx: ParseContext): Command | null {
  const t = input.trim().replace(/[?.!]+$/, '');
  if (/\b(?:brief me|briefing|morning brief|read (?:out |me )?my day|plan for (?:the )?day)\b/i.test(t)) return { kind: 'briefing' };

  const q = t.match(/^(?:what(?:'s| is|s)?|show(?: me)?|list|read(?: me)?|tell me)\s+(?:(?:is |do i have |have i got )?(?:on|due|planned|left|pending|my tasks|my list|the list|tasks)\s*)?(?:for |on )?(today|tomorrow|this week|the week|overdue|everything|all)?(?:\s+(?:tasks|list|to-?dos))?$/i)
    || t.match(/^what do i have (today|tomorrow|this week)$/i)
    || t.match(/^(aaj|kal) (?:ka plan|kya (?:hai|karna hai))$/i);
  if (q) {
    const r = (q[1] || 'today').toLowerCase();
    const range: Range = r === 'tomorrow' || r === 'kal' ? 'tomorrow' : r.includes('week') ? 'week' : r === 'overdue' ? 'overdue' : r === 'everything' || r === 'all' ? 'all' : 'today';
    return { kind: 'query', range };
  }

  const done = t.match(/^(?:mark|tick|check off)\s+(.+?)\s+(?:as\s+)?(?:done|complete|completed|finished)$/i)
    || t.match(/^(.+?)\s+(?:is done|done|ho gaya|ho gayi|kar diya|kar liya|completed|finished)$/i)
    || t.match(/^(?:done|completed|finished|i did|i have done)\s+(?:with\s+)?(.+)$/i);
  if (done) { const task = findTask(done[1], tasks); if (task) return { kind: 'complete', task }; }

  const mv = t.match(/^(?:move|shift|push|reschedule|postpone|change)\s+(.+?)\s+to\s+(.+)$/i);
  if (mv) {
    const task = findTask(mv[1], tasks);
    if (task) {
      const parsed = parseTasks(`do it ${mv[2]}`, ctx)[0];
      if (parsed && (parsed.due || parsed.time)) return { kind: 'move', task, due: parsed.due, time: parsed.time ?? task.time };
    }
  }

  const del = t.match(/^(?:delete|remove|drop|cancel)\s+(?:the\s+)?(?:task\s+)?(.+)$/i);
  if (del) { const task = findTask(del[1], tasks, 0.6); if (task) return { kind: 'delete', task }; }
  return null;
}
