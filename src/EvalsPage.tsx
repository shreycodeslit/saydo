import { useEffect, useState } from 'react';

interface Fields { title: boolean; due: boolean; time: boolean; repeat: boolean; priority: boolean }
interface CaseRow {
  id: number; group: string; input: string; correct: boolean; confident?: boolean; countOk: boolean;
  tasks: { expected: Record<string, unknown>; got: Record<string, unknown> | null; fields: Fields; correct: boolean }[];
}
interface Summary { cases: number; tasks: number; caseAccuracy: number; taskAccuracy: number; fields: { field: string; accuracy: number }[]; groups: { group: string; cases: number; accuracy: number }[] }
interface Report {
  model: string; ranAt: string; avgMsPerCase?: number; summary: Summary; cases: CaseRow[];
  routing?: { threshold: number; handledOnDevice: number; accuracyWhenConfident: number; sentToAi: number };
  heldout?: { summary: Summary; handledOnDevice: number; accuracyWhenConfident: number; cases: CaseRow[] };
  avgMs?: number; provider?: string;
}

const FIELD_NAMES: Record<string, string> = { title: 'Task wording', due: 'Date', time: 'Time', repeat: 'Repeat rule', priority: 'Priority' };

export default function EvalsPage() {
  const [device, setDevice] = useState<Report | null>(null);
  const [ai, setAi] = useState<Report | null>(null);
  const [onlyFails, setOnlyFails] = useState(true);
  const [set, setSet] = useState<'main' | 'heldout'>('main');
  useEffect(() => {
    fetch('/evals/device.json').then((r) => r.json()).then(setDevice).catch(() => setDevice(null));
    fetch('/evals/ai.json').then((r) => (r.ok ? r.json() : null)).then(setAi).catch(() => setAi(null));
  }, []);
  if (!device) return <main className="evals"><p>Loading results…</p></main>;

  const rows = (set === 'main' ? device.cases : device.heldout?.cases || []).filter((c) => !onlyFails || !c.correct);
  const aiById = new Map((ai?.cases || []).map((c) => [c.id, c]));

  return (
    <main className="evals">
      <h1>How well SayDo understands you</h1>
      <p className="lede">Every change to the parser is checked against a fixed set of phrases with hand-checked answers, as if spoken on Monday 23 November 2026 at 10 am in India. A task only counts as right when its wording, date, time, repeat rule and priority all match.</p>

      <div className="stats">
        <div><b>{device.summary.caseAccuracy}%</b><span>of {device.summary.cases} test phrases understood fully right on the device</span></div>
        {device.heldout && <div><b>{device.heldout.summary.caseAccuracy}%</b><span>on {device.heldout.summary.cases} unseen phrases written after tuning, never used to tune</span></div>}
        {device.routing && <div><b>{device.routing.handledOnDevice}%</b><span>handled on the device at no cost; the rest go to the free AI parser</span></div>}
        {ai && <div><b>{ai.summary.caseAccuracy}%</b><span>right with the AI parser ({ai.model}) on all {ai.summary.cases} phrases</span></div>}
      </div>

      <h2>How a phrase is handled</h2>
      <ol className="flow">
        <li><b>Speech to text</b> in the browser (free). Firefox users are recorded and transcribed by Whisper on Groq's free tier.</li>
        <li><b>On-device parser</b> splits the phrase into tasks and reads dates, times, repeats and priority with rules for English and Hinglish. It takes about {device.avgMsPerCase ?? 1} ms and scores its own confidence.</li>
        <li><b>Confident?</b> Save straight away. {device.routing && <>When the parser was confident it was right {device.routing.accuracyWhenConfident}% of the time.</>}</li>
        <li><b>Not confident</b> (Devanagari, unusual wording, very long phrases): the words go to Gemini's free tier, with Groq as a backup. The reply must match a strict schema, and code, not the model, works out repeat dates.</li>
        <li><b>You check</b> every task on a card before it is saved, and can ask the AI if the device got it wrong.</li>
      </ol>

      <h2>By kind of phrase</h2>
      <table className="grid">
        <thead><tr><th>Kind</th><th>Phrases</th><th>On device</th>{ai && <th>AI parser</th>}</tr></thead>
        <tbody>{device.summary.groups.map((g) => (
          <tr key={g.group}><td>{g.group}</td><td>{g.cases}</td><td>{g.accuracy}%</td>{ai && <td>{ai.summary.groups.find((x) => x.group === g.group)?.accuracy ?? '–'}%</td>}</tr>
        ))}</tbody>
      </table>
      <table className="grid">
        <thead><tr><th>Field</th><th>On device</th>{ai && <th>AI parser</th>}</tr></thead>
        <tbody>{device.summary.fields.map((f) => (
          <tr key={f.field}><td>{FIELD_NAMES[f.field]}</td><td>{f.accuracy}%</td>{ai && <td>{ai.summary.fields.find((x) => x.field === f.field)?.accuracy}%</td>}</tr>
        ))}</tbody>
      </table>

      <h2>Every phrase</h2>
      <div className="filters">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={set === 'main'} className={set === 'main' ? 'on' : ''} onClick={() => setSet('main')}>Test set ({device.summary.cases})</button>
          {device.heldout && <button role="tab" aria-selected={set === 'heldout'} className={set === 'heldout' ? 'on' : ''} onClick={() => setSet('heldout')}>Unseen set ({device.heldout.summary.cases})</button>}
        </div>
        <label className="toggle"><input type="checkbox" checked={onlyFails} onChange={(e) => setOnlyFails(e.target.checked)} /> Show only misses</label>
      </div>
      {!rows.length && <p className="empty">No misses in this set.</p>}
      <ul className="case-list">
        {rows.map((c) => {
          const aiRow = aiById.get(c.id);
          return (
            <li key={c.id} className={c.correct ? 'pass' : 'fail'}>
              <p className="case-in"><span className="verdict">{c.correct ? 'Right' : 'Missed'}</span>“{c.input}”{c.confident === false && <span className="routed">sent to AI</span>}{aiRow && <span className={`routed ${aiRow.correct ? 'ok' : ''}`}>AI: {aiRow.correct ? 'right' : 'missed'}</span>}</p>
              {!c.correct && c.tasks.map((t, i) => (
                <div key={i} className="diff">
                  <p><span>Expected</span>{fmtTask(t.expected)}</p>
                  <p><span>Got</span>{t.got ? fmtTask(t.got) : 'nothing'}{Object.entries(t.fields).filter(([, ok]) => !ok).length > 0 && <em> wrong: {Object.entries(t.fields).filter(([, ok]) => !ok).map(([k]) => FIELD_NAMES[k].toLowerCase()).join(', ')}</em>}</p>
                </div>
              ))}
            </li>
          );
        })}
      </ul>
      <p className="small">On-device results from {new Date(device.ranAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.{ai && ` AI results from ${new Date(ai.ranAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`} Run them yourself with <code>npm run eval</code>.</p>
    </main>
  );
}

function fmtTask(t: Record<string, unknown>): string {
  return [t.title, t.due, t.time, t.repeat, t.priority && t.priority !== 'normal' ? `${t.priority} priority` : null].filter(Boolean).join(' · ');
}
