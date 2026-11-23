import { useCallback, useEffect, useState } from 'react';
import { localParts, parseYmd, toUtc } from './core/dates';
import { nextOccurrence } from './core/repeat';
import type { ParsedTask, SavedTask } from './core/types';

const KEY = 'saydo.tasks.v1';
const SEEDED = 'saydo.seeded.v1';

export const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
export const todayYmd = () => { const p = localParts(new Date(), TZ); return { y: p.y, m: p.m, d: p.d }; };
export const todayStr = () => { const t = todayYmd(); return `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`; };

const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function load(): SavedTask[] {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as SavedTask[]) : []; } catch { return []; }
}
function save(tasks: SavedTask[]) {
  try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch { /* private mode: keep in memory */ }
}

/** A few example tasks on the very first visit, so the lists aren't empty. */
function samples(): SavedTask[] {
  const t = todayYmd(); const add = (n: number) => { const d = toUtc(t); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const mk = (p: Partial<SavedTask> & { title: string }): SavedTask => ({ id: id(), done: false, createdAt: new Date().toISOString(), source: 'device', due: null, time: null, repeat: null, priority: 'normal', tags: [], confidence: 1, question: null, ...p });
  return [
    mk({ title: 'Call mom', due: add(0), time: '18:00', tags: ['Family'] }),
    mk({ title: 'Pay the electricity bill', due: add(3), priority: 'high', tags: ['Bills'] }),
    mk({ title: 'Take vitamins', due: add(1), time: '09:00', repeat: 'FREQ=DAILY', tags: ['Health'] }),
    mk({ title: 'Get the car washed', due: add(5), repeat: 'FREQ=MONTHLY;BYDAY=2SA' }),
  ];
}

export function useTasks() {
  const [tasks, setTasks] = useState<SavedTask[]>(() => {
    const existing = load();
    let seeded = false;
    try { seeded = !!localStorage.getItem(SEEDED); localStorage.setItem(SEEDED, '1'); } catch { /* ignore */ }
    return existing.length || seeded ? existing : samples();
  });
  useEffect(() => save(tasks), [tasks]);

  const addTasks = useCallback((list: ParsedTask[], source: SavedTask['source']) => {
    setTasks((prev) => [...list.map((t) => ({ ...t, id: id(), done: false, createdAt: new Date().toISOString(), source })), ...prev]);
  }, []);
  const update = useCallback((tid: string, patch: Partial<SavedTask>) => setTasks((prev) => prev.map((t) => (t.id === tid ? { ...t, ...patch } : t))), []);
  const remove = useCallback((tid: string) => setTasks((prev) => prev.filter((t) => t.id !== tid)), []);

  /** Ticking a repeating task moves it to its next occurrence instead of finishing it. */
  const complete = useCallback((tid: string) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== tid) return t;
      if (t.repeat) {
        const base = t.due ? parseYmd(t.due) : todayYmd();
        const next = nextOccurrence(t.repeat, base, 24 * 60 - 1, t.time);
        if (next) return { ...t, due: next };
      }
      return { ...t, done: true, doneAt: new Date().toISOString() };
    }));
  }, []);
  const undo = useCallback((tid: string) => update(tid, { done: false, doneAt: null }), [update]);
  const clearDone = useCallback(() => setTasks((prev) => prev.filter((t) => !t.done)), []);

  return { tasks, addTasks, update, remove, complete, undo, clearDone };
}

export function sortTasks(list: SavedTask[]) {
  const rank = { high: 0, normal: 1, low: 2 } as const;
  return [...list].sort((a, b) =>
    (a.due || '9999').localeCompare(b.due || '9999') || (a.time || '99').localeCompare(b.time || '99') || rank[a.priority] - rank[b.priority]);
}
