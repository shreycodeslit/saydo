import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { detectCommand, type Range } from './core/commands';
import { addDays, friendlyDate, friendlyTime, parseYmd } from './core/dates';
import { highlight } from './core/highlight';
import { describeRule } from './core/repeat';
import { parseSmart } from './core/router';
import type { ParsedTask, ParseSource, SavedTask } from './core/types';
import EvalsPage from './EvalsPage';
import { sortTasks, todayStr, todayYmd, TZ, useTasks } from './store';
import { speak, useSpeech } from './useSpeech';

const SAMPLES = [
  'Pay the electricity bill before the 10th, call mom Sunday evening, and every second Saturday get the car washed',
  'kal subah 8 baje doctor ke paas jana hai aur bijli ka bill bharna 10 tarikh se pehle',
  'Urgent: submit the report by Friday, and gym every weekday at 7am',
  "What's on today?",
];

const SOURCE_LABEL: Record<ParseSource, string> = { device: 'Understood on your device', gemini: 'Understood by Gemini (free tier)', groq: 'Understood by Groq (free tier)', sample: 'Sample' };
type Tab = 'today' | 'upcoming' | 'repeating' | 'done';
type Review = { tasks: ParsedTask[]; source: ParseSource; ms: number; note?: string };

const REPEAT_OPTIONS: [string, string][] = [
  ['', "Doesn't repeat"], ['FREQ=DAILY', 'Every day'], ['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'Every weekday'],
  ['FREQ=WEEKLY', 'Every week'], ['FREQ=WEEKLY;INTERVAL=2', 'Every 2 weeks'], ['FREQ=MONTHLY', 'Every month'], ['FREQ=YEARLY', 'Every year'],
];

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(() => { try { return (localStorage.getItem('saydo.theme') as 'light' | 'dark' | null) || null; } catch { return null; } });
  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme); else document.documentElement.removeAttribute('data-theme');
    try { if (theme) localStorage.setItem('saydo.theme', theme); } catch { /* ignore */ }
  }, [theme]);
  const isDark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { isDark, toggle: () => setTheme(isDark ? 'light' : 'dark') };
}

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => { const f = () => { setRoute(window.location.hash); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const theme = useTheme();
  return (
    <div className="page">
      <header className="top">
        <a className="mark" href="#" aria-label="SayDo home"><span className="mark-dot" aria-hidden="true" />SayDo</a>
        <nav>
          <a href={route === '#how-it-works' ? '#' : '#how-it-works'}>{route === '#how-it-works' ? 'Back to my tasks' : 'How well it works'}</a>
          <button className="icon-btn" onClick={theme.toggle} aria-label={theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
            {theme.isDark
              ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></svg>
              : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>}
          </button>
        </nav>
      </header>
      {route === '#how-it-works' ? <EvalsPage /> : <Home />}
      <footer className="foot">
        <p>Your tasks stay in this browser. Nothing is sent anywhere unless the AI parser is needed, and then only the words you said.</p>
        <p>Built by <a href="https://shreygupta-three.vercel.app" target="_blank" rel="noopener">Shrey Gupta</a> · <a href="https://github.com/shreycodeslit/saydo" target="_blank" rel="noopener">Code on GitHub</a></p>
      </footer>
    </div>
  );
}

function Home() {
  const store = useTasks();
  const [lang, setLang] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [typed, setTyped] = useState('');
  const [heard, setHeard] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [thinking, setThinking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const toastTimer = useRef<number | undefined>(undefined);

  const say = useCallback((msg: string, aloud = false) => {
    setToast(msg); window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
    if (aloud) speak(msg);
  }, []);

  const handle = useCallback(async (text: string, viaVoice: boolean) => {
    const clean = text.trim();
    if (!clean) return;
    setHeard(clean);
    const ctx = { now: new Date(), timeZone: TZ };
    const cmd = detectCommand(clean, store.tasks, ctx);
    if (cmd) {
      setReview(null);
      if (cmd.kind === 'query' || cmd.kind === 'briefing') {
        const msg = cmd.kind === 'briefing' ? briefing(store.tasks) : summary(store.tasks, cmd.range);
        if (cmd.kind === 'query') setTab(cmd.range === 'today' || cmd.range === 'overdue' ? 'today' : 'upcoming');
        say(msg, viaVoice || cmd.kind === 'briefing');
      } else if (cmd.kind === 'complete') { store.complete(cmd.task.id); say(cmd.task.repeat ? `Done. "${cmd.task.title}" moved to its next date.` : `Marked "${cmd.task.title}" done.`); }
      else if (cmd.kind === 'move') { store.update(cmd.task.id, { due: cmd.due ?? cmd.task.due, time: cmd.time }); say(`Moved "${cmd.task.title}" to ${[friendlyDate(cmd.due, todayYmd()), friendlyTime(cmd.time)].filter(Boolean).join(', ')}.`); }
      else if (cmd.kind === 'delete') { store.remove(cmd.task.id); say(`Deleted "${cmd.task.title}".`); }
      return;
    }
    setThinking(true);
    const r = await parseSmart(clean, ctx);
    setThinking(false);
    setReview({ tasks: r.tasks, source: r.source, ms: r.ms, note: r.fallback ? 'The AI parser was unavailable, so this was understood on your device. Check it before saving.' : undefined });
  }, [say, store]);

  const speech = useSpeech((t) => handle(t, true));
  const live = speech.listening ? speech.interim : heard;

  const lists = useMemo(() => {
    const today = todayStr();
    const open = store.tasks.filter((t) => !t.done);
    return {
      today: sortTasks(open.filter((t) => t.due && t.due <= today)),
      upcoming: sortTasks(open.filter((t) => !t.due || t.due > today)),
      repeating: sortTasks(open.filter((t) => t.repeat)),
      done: [...store.tasks.filter((t) => t.done)].sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')),
    };
  }, [store.tasks]);

  const saveReview = () => {
    if (!review) return;
    store.addTasks(review.tasks.filter((t) => t.title.trim()), review.source === 'device' ? 'device' : 'ai');
    const n = review.tasks.length;
    setReview(null); setHeard(''); setTyped('');
    const firstDue = review.tasks.map((t) => t.due).filter(Boolean).sort()[0];
    setTab(firstDue && firstDue <= todayStr() ? 'today' : 'upcoming');
    say(`Saved ${n} task${n === 1 ? '' : 's'}.`);
  };

  return (
    <main>
      <section className="capture" aria-label="Add tasks by voice or text">
        <h1>Say it the way you'd tell a friend.</h1>
        <p className="lede">English, Hindi or Hinglish. SayDo turns it into tasks with the right dates, times and repeats.</p>

        <div className={`panel${speech.listening ? ' is-listening' : ''}`}>
          <div className="transcript" aria-live="polite">
            {live ? <p>{highlight(live).map((p, i) => p.kind ? <mark key={i} className={`m-${p.kind}`}>{p.text}</mark> : <span key={i}>{p.text}</span>)}</p>
              : <p className="placeholder">{speech.listening ? 'Listening…' : 'Tap the mic and start talking.'}</p>}
            {(thinking || speech.busy) && <p className="status">{speech.busy ? 'Turning your voice into text…' : 'Understanding…'}</p>}
            {speech.error && <p className="status error">{speech.error}</p>}
          </div>
          <div className="controls">
            <div className="lang" role="group" aria-label="Speaking language">
              <button className={lang === 'en-IN' ? 'on' : ''} onClick={() => setLang('en-IN')} aria-pressed={lang === 'en-IN'}>English</button>
              <button className={lang === 'hi-IN' ? 'on' : ''} onClick={() => setLang('hi-IN')} aria-pressed={lang === 'hi-IN'}>हिंदी</button>
            </div>
            <form className="type" onSubmit={(e) => { e.preventDefault(); handle(typed, false); }}>
              <label className="sr" htmlFor="typed">Type tasks instead</label>
              <input id="typed" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="…or type it here" autoComplete="off" />
            </form>
            <button
              className="mic"
              onClick={() => (speech.listening ? speech.stop() : speech.start(lang))}
              disabled={speech.mode === 'none' || speech.busy}
              aria-label={speech.listening ? 'Stop listening' : 'Start speaking'}
            >
              {speech.listening ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
                : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>}
            </button>
          </div>
        </div>
        <div className="legend" aria-hidden={!live}>
          {live && <><span><mark className="m-when">when</mark></span><span><mark className="m-repeat">repeats</mark></span><span><mark className="m-priority">priority</mark></span></>}
        </div>

        {!review && (
          <div className="samples">
            <p>Try one:</p>
            <ul>{SAMPLES.map((s) => <li key={s}><button onClick={() => handle(s, false)}>“{s}”</button></li>)}</ul>
          </div>
        )}
      </section>

      {review && (
        <section className="review" aria-label="Check before saving">
          <div className="review-head">
            <h2>{review.tasks.length ? `${review.tasks.length} task${review.tasks.length === 1 ? '' : 's'} found` : 'No tasks found'}</h2>
            <p className="source"><span className={`src src-${review.source}`}>{SOURCE_LABEL[review.source]}</span> in {review.ms < 1000 ? `${review.ms} ms` : `${(review.ms / 1000).toFixed(1)} s`}</p>
          </div>
          {review.note && <p className="note">{review.note}</p>}
          <ul className="cards">
            {review.tasks.map((t, i) => (
              <ReviewCard key={i} task={t}
                onChange={(patch) => setReview((r) => r && { ...r, tasks: r.tasks.map((x, j) => (j === i ? { ...x, ...patch } : x)) })}
                onRemove={() => setReview((r) => r && { ...r, tasks: r.tasks.filter((_, j) => j !== i) })} />
            ))}
          </ul>
          <div className="review-actions">
            <button className="primary" onClick={saveReview} disabled={!review.tasks.length}>Save {review.tasks.length > 1 ? 'all' : 'task'}</button>
            <button onClick={() => { setReview(null); setHeard(''); }}>Discard</button>
            {review.source === 'device' && <button className="ghost" onClick={async () => {
              setThinking(true); const r = await parseSmart(heard, { now: new Date(), timeZone: TZ }, { forceAi: true }); setThinking(false);
              setReview({ tasks: r.tasks, source: r.source, ms: r.ms, note: r.fallback ? 'The AI parser is unavailable right now, so this is still the on-device result.' : undefined });
            }}>Not right? Ask the AI</button>}
          </div>
        </section>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      <section className="lists" aria-label="Your tasks">
        <div className="lists-head">
          <div className="tabs" role="tablist">
            {(['today', 'upcoming', 'repeating', 'done'] as Tab[]).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                {k[0].toUpperCase() + k.slice(1)} <span className="count">{lists[k].length}</span>
              </button>
            ))}
          </div>
          <button className="brief" onClick={() => say(briefing(store.tasks), true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>
            Play today's briefing
          </button>
        </div>
        <TaskList tab={tab} tasks={lists[tab]} store={store} />
      </section>
    </main>
  );
}

function ReviewCard({ task, onChange, onRemove }: { task: ParsedTask; onChange: (p: Partial<ParsedTask>) => void; onRemove: () => void }) {
  const known = REPEAT_OPTIONS.some(([v]) => v === (task.repeat || ''));
  return (
    <li className={`card${task.question ? ' unsure' : ''}`}>
      <input className="title" value={task.title} onChange={(e) => onChange({ title: e.target.value })} aria-label="Task" />
      <div className="fields">
        <label><span>Date</span><input type="date" value={task.due || ''} onChange={(e) => onChange({ due: e.target.value || null })} /></label>
        <label><span>Time</span><input type="time" value={task.time || ''} onChange={(e) => onChange({ time: e.target.value || null })} /></label>
        <label><span>Repeats</span>
          <select value={task.repeat || ''} onChange={(e) => onChange({ repeat: e.target.value || null })}>
            {!known && <option value={task.repeat || ''}>{describeRule(task.repeat)}</option>}
            {REPEAT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label><span>Priority</span>
          <select value={task.priority} onChange={(e) => onChange({ priority: e.target.value as ParsedTask['priority'] })}>
            <option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
          </select>
        </label>
      </div>
      <p className="readback">{readBack(task)}</p>
      {task.question && <p className="question">{task.question}</p>}
      <button className="x" onClick={onRemove} aria-label={`Remove “${task.title}”`}>×</button>
    </li>
  );
}

function TaskList({ tab, tasks, store }: { tab: Tab; tasks: SavedTask[]; store: ReturnType<typeof useTasks> }) {
  const today = todayStr();
  if (!tasks.length) {
    const empty: Record<Tab, string> = { today: 'Nothing due today. Say something like “call the plumber tomorrow at 5”.', upcoming: 'Nothing coming up.', repeating: 'No repeating tasks. Try “take vitamins every morning”.', done: 'Finished tasks show up here.' };
    return <p className="empty">{empty[tab]}</p>;
  }
  return (
    <>
      <ul className="rows">
        {tasks.map((t) => {
          const overdue = !t.done && t.due && t.due < today;
          return (
            <li key={t.id} className={`row${t.done ? ' is-done' : ''}${t.priority === 'high' ? ' is-high' : ''}`}>
              <button className="check" onClick={() => (t.done ? store.undo(t.id) : store.complete(t.id))} aria-label={t.done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" /></svg>
              </button>
              <div className="row-main">
                <p className="row-title">{t.title}</p>
                <p className="row-meta">
                  {t.due && <span className={overdue ? 'late' : ''}>{overdue ? 'Overdue · ' : ''}{friendlyDate(t.due, parseYmd(today))}{t.time ? `, ${friendlyTime(t.time)}` : ''}</span>}
                  {!t.due && t.time && <span>{friendlyTime(t.time)}</span>}
                  {t.repeat && <span className="rep">{describeRule(t.repeat)}</span>}
                  {t.priority !== 'normal' && <span className={`pri pri-${t.priority}`}>{t.priority === 'high' ? 'High priority' : 'Low priority'}</span>}
                  {t.tags.map((g) => <span key={g} className="tag">{g}</span>)}
                </p>
              </div>
              <button className="del" onClick={() => store.remove(t.id)} aria-label={`Delete “${t.title}”`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>
              </button>
            </li>
          );
        })}
      </ul>
      {tab === 'done' && <button className="ghost clear" onClick={store.clearDone}>Clear finished tasks</button>}
    </>
  );
}

function readBack(t: ParsedTask): string {
  const bits = [t.due ? friendlyDate(t.due, todayYmd()) : 'No date', t.time ? `at ${friendlyTime(t.time)}` : '', t.repeat ? `· ${describeRule(t.repeat).replace(/^Every/, 'every')}` : ''];
  return bits.filter(Boolean).join(' ');
}

function listOut(ts: SavedTask[]): string {
  const parts = ts.slice(0, 6).map((t) => `${t.title}${t.time ? ` at ${friendlyTime(t.time)}` : ''}`);
  if (ts.length > 6) parts.push(`and ${ts.length - 6} more`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || '';
}

function summary(tasks: SavedTask[], range: Range): string {
  const today = todayStr(); const tomorrow = (() => { const d = addDays(todayYmd(), 1); return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`; })();
  const weekEnd = (() => { const d = addDays(todayYmd(), 7); return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`; })();
  const open = sortTasks(tasks.filter((t) => !t.done));
  const pick = range === 'tomorrow' ? open.filter((t) => t.due === tomorrow)
    : range === 'week' ? open.filter((t) => t.due && t.due <= weekEnd)
      : range === 'overdue' ? open.filter((t) => t.due && t.due < today)
        : range === 'all' ? open : open.filter((t) => t.due && t.due <= today);
  const when = { today: 'today', tomorrow: 'tomorrow', week: 'this week', overdue: 'overdue', all: 'in total' }[range];
  if (!pick.length) return range === 'overdue' ? 'Nothing is overdue.' : `Nothing ${range === 'all' ? 'on your list' : `due ${when}`}.`;
  return `${pick.length} task${pick.length === 1 ? '' : 's'} ${when}: ${listOut(pick)}.`;
}

function briefing(tasks: SavedTask[]): string {
  const today = todayStr();
  const open = sortTasks(tasks.filter((t) => !t.done));
  const late = open.filter((t) => t.due && t.due < today);
  const now = open.filter((t) => t.due === today);
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';
  const parts = [hello];
  parts.push(now.length ? `Today you have ${now.length} task${now.length === 1 ? '' : 's'}: ${listOut(now)}.` : 'Nothing is due today.');
  if (late.length) parts.push(`${late.length} ${late.length === 1 ? 'is' : 'are'} overdue: ${listOut(late)}.`);
  const high = open.filter((t) => t.priority === 'high' && t.due !== today && !(t.due && t.due < today));
  if (high.length) parts.push(`Coming up and important: ${listOut(high.slice(0, 2))}.`);
  return parts.join(' ');
}
