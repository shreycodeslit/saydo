// Checks the AI route with fake providers: happy path, fallback to Groq, bad JSON, and input limits.
process.env.GEMINI_API_KEY = 'test'; process.env.GROQ_API_KEY = 'test';
const reply = { tasks: [{ title: 'book the gas cylinder', due: '2026-11-26', time: null, repeat: null, priority: 'normal', question: null },
  { title: 'Society meeting', due: '2026-11-19', time: '19:00', repeat: 'RRULE:FREQ=MONTHLY;BYDAY=3TH', priority: 'normal', question: null }] };
let mode: 'ok' | 'geminiDown' | 'garbage' = 'ok';
const calls: string[] = [];
globalThis.fetch = (async (url: string) => {
  const u = String(url); calls.push(u.includes('googleapis') ? 'gemini' : 'groq');
  if (u.includes('googleapis')) {
    if (mode === 'geminiDown') return new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 });
    const text = mode === 'garbage' ? 'sorry, I cannot' : '```json\n' + JSON.stringify(reply) + '\n```';
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
  }
  if (mode === 'garbage') return new Response(JSON.stringify({ choices: [{ message: { content: '{"tasks": "nope"}' } }] }), { status: 200 });
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }), { status: 200 });
}) as typeof fetch;
const { default: handler } = await import('../api/parse');
const post = (body: unknown, ip = '1.1.1.1') => handler(new Request('http://x/api/parse', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify(body) }));
const now = '2026-11-23T04:30:00.000Z';
let r = await post({ text: 'the gas cylinder needs booking by thursday, and every 3rd thursday society meeting at 7pm', now, timeZone: 'Asia/Kolkata' });
console.log('ok', r.status, JSON.stringify(await r.json()));
mode = 'geminiDown'; calls.length = 0;
r = await post({ text: 'x y', now }); console.log('fallback', r.status, (await r.json()).source, calls);
mode = 'garbage';
r = await post({ text: 'x y', now }); console.log('garbage', r.status, (await r.json()).error);
mode = 'ok';
r = await post({ text: 'a'.repeat(601) }); console.log('too long', r.status);
r = await post({ text: '' }); console.log('empty', r.status);
let last = 0; for (let i = 0; i < 22; i++) last = (await post({ text: 'hi there', now }, '9.9.9.9')).status; console.log('rate limit', last);
