// On-device task parser: turns "pay the electricity bill before the 10th and call mom sunday evening"
// into dated tasks with no network call. Anything it is unsure about gets a low confidence score,
// and the app then asks the AI parser instead (see router.ts).
import * as chrono from 'chrono-node';
import {
  WEEKDAYS, RRULE_DAYS, addDays, fmt, localParts, nextMonthDay, nextWeekday, offsetMinutes, sameDay, weekday, type Ymd,
} from './dates';
import { nextOccurrence } from './repeat';
import type { ParsedTask, Priority } from './types';

export interface ParseContext { now: Date; timeZone: string }

/** Times used when someone says a part of the day without a clock time. */
export const PART_OF_DAY: Record<string, string> = { morning: '09:00', noon: '12:00', afternoon: '14:00', evening: '18:00', night: '21:00', tonight: '21:00' };

const WD = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday)';
const MONTHS = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

// Hinglish and spoken shortcuts → plain English time words the rest of the parser understands.
const NUM_WORDS: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', ek: '1', do: '2', teen: '3', char: '4', paanch: '5', chhe: '6', saat: '7', aath: '8', nau: '9', das: '10', gyarah: '11', barah: '12' };
const num = (w: string) => NUM_WORDS[w.toLowerCase()] ?? w;

const NORMALIZE: [RegExp, string | ((...a: string[]) => string)][] = [
  [/\bsom(?:v|w)aa?r\b/gi, 'monday'], [/\bmangal(?:v|w)aa?r\b/gi, 'tuesday'], [/\bbudh(?:v|w)aa?r\b/gi, 'wednesday'],
  [/\b(?:guru(?:v|w)aa?r|brihaspati(?:v|w)aa?r)\b/gi, 'thursday'], [/\bshukra?(?:v|w)aa?r\b/gi, 'friday'],
  [/\bshani(?:v|w)aa?r\b/gi, 'saturday'], [/\b(?:ravi(?:v|w)aa?r|itvaa?r|itwaa?r)\b/gi, 'sunday'],
  [/\bday after tomorrow\b/gi, 'in 2 days'], [/\bparso[n]?\b/gi, 'in 2 days'],
  [/\bagle hafte\b/gi, 'next week'], [/\bagle mahine\b/gi, 'next month'], [/\bis hafte\b/gi, 'this week'],
  [/\b(?:mahine|month) ke (?:end|aakhir|akhir) (?:tak|mein|me)\b/gi, 'by end of month'],
  [/\bend of (?:the |this )?week\b/gi, 'this sunday'],
  [/\b(\d{1,2}) tarikh\b/gi, '$1th'],
  [/\b(\d{1,2}) baje\b/gi, 'at $1'],
  [/\bkal\b/gi, 'tomorrow'], [/\baaj\b/gi, 'today'],
  [/\bsubah\b/gi, 'morning'], [/\bdopahar\b/gi, 'afternoon'], [/\bshaam\b/gi, 'evening'], [/\braat\b/gi, 'night'],
  [/\bhar roz\b|\brozana\b|\broz\b|\bhar din\b|\bdaily\b|\beveryday\b/gi, 'every day'],
  [/\bhar hafte\b/gi, 'every week'], [/\bhar mahine\b/gi, 'every month'], [/\bhar saal\b/gi, 'every year'],
  [/\bhar (?=(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|morning|evening|night)\b)/gi, 'every '],
  [/\bquarter past (\w+)\b/gi, (_m: string, h: string) => `at ${num(h)}:15`],
  [/\bhalf past (\w+)\b/gi, (_m: string, h: string) => `at ${num(h)}:30`],
  [/\bquarter to (\w+)\b/gi, (_m: string, h: string) => `at ${(Number(num(h)) + 11) % 12 || 12}:45`],
  [/\bsaade (\w+)\b/gi, (_m: string, h: string) => `at ${num(h)}:30`],
  [/\bbetween (\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?) (?:and|to|-) \d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?\b/gi, 'at $1'],
  [/\bse pehle\b/gi, 'before'], [/\b(?:ke baad)\b/gi, 'after'],
];

const VERBS = new Set(('call pay buy book send email mail text message pick drop get take clean renew submit meet go visit finish check order fix wash ' +
  'cook water print recharge transfer file schedule cancel collect return bring write read study practise practice prepare plan review update ' +
  'apply ask tell remind remember start complete do make clean iron feed walk run attend join reply follow change replace charge pack ' +
  'deposit withdraw sign post upload download install backup back service repair refill top call').split(' '));

const FILLERS_START = /^(?:\s*(?:and|also|then|phir|aur|please|pls|ok|okay|so|remind me to|remind me|remember to|don'?t forget to|do not forget to|i need to|i have to|i must|i should|need to|have to|i want to|i gotta|gotta|let'?s|mujhe|yaad se|to)\b[\s,]*)+/i;
const FILLERS_END = /(?:\s*\b(?:yaad dilana|yaad se|please|pls|okay|ok|hai)\b[\s.,!]*)+$/i;
const CONNECT_BEFORE = /(?:\b(?:before|by|on|at|till|until|from|due|for|the|this|coming|in the|of|around|latest by)\s*)+$/i;
const CONNECT_AFTER = /^\s*(?:ko|tak|wala|wali|before|ke pehle|se|ke liye)\b/i;

const HIGH = /\b(?:urgent(?:ly)?|asap|important|zaroori|jaldi|high priority|top priority|must)\b|!!+/gi;
const LOW = /\b(?:sometime|someday|whenever|low priority|if possible|kabhi bhi|no rush)\b/gi;

const TAG_WORDS: [string, RegExp][] = [
  ['Bills', /\b(?:bill|bills|rent|emi|recharge|electricity|bijli|gas|insurance|premium|tax|fees?|pay|payment|loan|credit card|dth|wifi|broadband|maintenance)\b/i],
  ['Family', /\b(?:mom|mummy|mumma|maa|papa|dad|mother|father|didi|bhai|bhaiya|sister|brother|wife|husband|kids?|son|daughter|nani|dadi|nana|dada|family|parents|chacha|mama|bua|masi)\b/i],
  ['Health', /\b(?:doctor|dentist|medicine|medicines|dawai|gym|checkup|check-up|walk|yoga|blood test|vaccine|pharmacy|run|workout|physio)\b/i],
  ['Work', /\b(?:meeting|report|client|presentation|deadline|office|standup|interview|manager|boss|invoice|proposal|deck|resume|project)\b/i],
  ['Home', /\b(?:clean|wash|laundry|groceries|grocery|milk|doodh|sabzi|vegetables|repair|plumber|electrician|cook|plants|iron|dishes|maid|cylinder)\b/i],
  ['Errands', /\b(?:bank|post office|courier|parcel|pick up|pickup|drop|collect|return|buy|order|amazon|atm|passport|license|licence|aadhaar|pan card)\b/i],
];

const hasDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);

export function normalize(text: string): string {
  let t = ` ${text} `.replace(/\s+/g, ' ');
  for (const [re, to] of NORMALIZE) t = t.replace(re, to as never);
  return t.trim();
}

/** Splits one utterance into separate task phrases. */
export function splitTasks(text: string): string[] {
  const coarse = text
    .split(/\s*(?:[;\n]|,\s*(?:and\s+)?then\b|\.\s+|\s+and then\s+|\s+then\s+|\s+phir\s+|\s+aur phir\s+|\s+also\s+)\s*/i)
    .flatMap((part) => part.split(/\s*,\s*/))
    .map((s) => s.trim()).filter(Boolean);

  // Glue short fragments back ("buy milk, eggs, and bread" stays one task)
  const merged: string[] = [];
  for (const part of coarse) {
    const bare = part.replace(/^(?:and|aur|&)\s+/i, '');
    const prev = merged[merged.length - 1];
    // A list item after a verb phrase ("buy milk, eggs and bread tomorrow") belongs to that task
    const listItem = !!prev && !startsWithVerb(bare) && startsWithVerb(prev) && !hasTimeWords(prev)
      && bare.replace(TIME_WORDS, ' ').trim().split(/\s+/).length <= 4 && !/(?:na|ni|ne)$/i.test(bare.replace(TIME_WORDS, ' ').trim());
    const looksLikeTask = startsWithVerb(bare) || hasTimeWords(bare) || bare.split(/\s+/).length >= 3;
    if (prev && (listItem || !looksLikeTask)) merged[merged.length - 1] += `, ${part}`;
    else merged.push(part);
  }

  // Split on "and" / "aur" only where a new task clearly starts
  return merged.flatMap((part) => {
    const out: string[] = [];
    let rest = part;
    for (;;) {
      const m = rest.match(/\s+(?:and|aur|&)\s+/i);
      if (!m || m.index === undefined) { out.push(rest); break; }
      const left = rest.slice(0, m.index), right = rest.slice(m.index + m[0].length);
      const isAur = /aur/i.test(m[0]);
      const splitHere = startsWithVerb(right) || (isAur && left.split(/\s+/).length >= 2 && right.split(/\s+/).length >= 2);
      if (splitHere) { out.push(left); rest = right; }
      else {
        // keep "and" inside this task, keep looking further along
        const tail = right;
        const next = tail.match(/\s+(?:and|aur|&)\s+/i);
        if (!next || next.index === undefined) { out.push(rest); break; }
        const cut = m.index + m[0].length + next.index;
        const l2 = rest.slice(0, cut), r2 = rest.slice(cut + next[0].length);
        if (startsWithVerb(r2)) { out.push(l2); rest = r2; } else { out.push(rest); break; }
      }
    }
    return out;
  }).map((s) => s.trim()).filter(Boolean);
}

function startsWithVerb(s: string): boolean {
  const w = s.replace(FILLERS_START, '').trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g, '');
  return !!w && VERBS.has(w);
}

const TIME_WORDS = new RegExp(`\\b(?:${WD}|today|tomorrow|tonight|morning|evening|night|afternoon|next|this|week|month|every|at|on|by|\\d{1,2}(?:st|nd|rd|th)|\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)\\b`, 'gi');

function hasTimeWords(s: string): boolean {
  return new RegExp(`\\b(?:${WD}|today|tomorrow|tonight|morning|evening|night|afternoon|week|month|year|every|\\d{1,2}(?:st|nd|rd|th)|\\d{1,2}(?::\\d{2})?\\s*(?:am|pm))\\b`, 'i').test(s);
}

interface Cut { text: string }
function cut(state: Cut, start: number, end: number) {
  let before = state.text.slice(0, start), after = state.text.slice(end);
  before = before.replace(CONNECT_BEFORE, '');
  after = after.replace(CONNECT_AFTER, '');
  state.text = `${before} ${after}`.replace(/\s+/g, ' ').trim();
}

function cleanTitle(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) {
    t = t.replace(FILLERS_START, '').replace(FILLERS_END, '').replace(CONNECT_BEFORE, '').replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').trim();
  }
  t = t.replace(/\s+([,.])/g, '$1');
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

export function parseTasks(input: string, ctx: ParseContext): ParsedTask[] {
  const text = input.trim();
  if (!text) return [];
  const lp = localParts(ctx.now, ctx.timeZone);
  const today: Ymd = { y: lp.y, m: lp.m, d: lp.d };
  const nowMin = lp.hh * 60 + lp.mm;
  return splitTasks(normalize(text)).map((phrase) => parseOne(phrase, today, nowMin, ctx)).filter((t) => t.title);
}

function parseOne(phrase: string, today: Ymd, nowMin: number, ctx: ParseContext): ParsedTask {
  const st: Cut = { text: phrase };
  let priority: Priority = 'normal';
  let due: Ymd | null = null;
  let time: string | null = null;
  let repeat: string | null = null;
  let anchor: Ymd | null = null;
  let partTime: string | null = null;
  let partWord: string | null = null;
  let penalty = 0;

  // 1. Priority words
  if (HIGH.test(st.text)) { priority = 'high'; st.text = st.text.replace(HIGH, ' '); }
  HIGH.lastIndex = 0;
  if (LOW.test(st.text)) { priority = 'low'; st.text = st.text.replace(LOW, ' '); }
  LOW.lastIndex = 0;
  st.text = st.text.replace(/\s+/g, ' ').trim();

  // 2. Repeats
  const rep = findRepeat(st.text);
  if (rep) {
    repeat = rep.rule;
    if (rep.time) { partTime = rep.time; partWord = rep.partWord ?? null; }
    cut(st, rep.start, rep.end);
  }

  // 3. Part of the day ("evening", "tonight")
  const pod = st.text.match(/\b(?:this |in the |at )?(morning|noon|afternoon|evening|night|tonight)\b/i);
  if (pod && pod.index !== undefined) {
    const w = pod[1].toLowerCase();
    partTime = PART_OF_DAY[w]; partWord = w;
    if (w === 'tonight' || /^this /i.test(pod[0])) due = today;
    cut(st, pod.index, pod.index + pod[0].length);
  }

  const n2n = st.text.match(new RegExp(`\\bnext to next ${WD}\\b`, 'i'));
  if (n2n && n2n.index !== undefined) {
    due = addDays(nextWeekday(today, WEEKDAYS.indexOf(n2n[1].toLowerCase() as typeof WEEKDAYS[number])), 7);
    cut(st, n2n.index, n2n.index + n2n[0].length);
  }

  // 4. "next <weekday>" = the coming one (in India "next Friday" usually means this coming Friday)
  const nextWd = st.text.match(new RegExp(`\\b(?:next|coming|this) ${WD}\\b`, 'i'));
  if (nextWd && nextWd.index !== undefined) {
    due = nextWeekday(today, WEEKDAYS.indexOf(nextWd[1].toLowerCase() as typeof WEEKDAYS[number]));
    cut(st, nextWd.index, nextWd.index + nextWd[0].length);
  }

  // 5. "next month" = the 1st of next month
  const nm = st.text.match(/\bnext month\b/i);
  if (nm && nm.index !== undefined && !repeat) {
    due = today.m === 12 ? { y: today.y + 1, m: 1, d: 1 } : { y: today.y, m: today.m + 1, d: 1 };
    cut(st, nm.index, nm.index + nm[0].length);
  }

  // 6. Dates and clock times (chrono)
  const ref = { instant: ctx.now, timezone: offsetMinutes(ctx.now, ctx.timeZone) };
  const results = chrono.parse(st.text, ref, { forwardDate: true });
  // Process right to left so earlier indexes stay valid while cutting
  const meaningful = new RegExp(`\\d|today|tomorrow|tonight|week|month|year|days?\\b|noon|midnight|${WD}|${MONTHS}`, 'i');
  for (const r of [...results].filter((x) => meaningful.test(x.text)).sort((a, b) => b.index - a.index)) {
    const s = r.start;
    const knowsDay = s.isCertain('day') || s.isCertain('weekday') || /\b(?:today|tomorrow|week|weekend|month|days?)\b/i.test(r.text);
    if (knowsDay && !(repeat && /every/i.test(r.text))) {
      let d: Ymd = { y: s.get('year')!, m: s.get('month')!, d: s.get('day')! };
      const saysWeekday = new RegExp(`\\b${WD}\\b`, 'i').test(r.text) && !/\b(?:today|this|tonight)\b/i.test(r.text);
      if (saysWeekday && sameDay(d, today)) d = addDays(d, 7);
      if (repeat) anchor = d; else due = d;
    }
    if (s.isCertain('hour')) {
      let h = s.get('hour')!; const mi = s.get('minute') ?? 0;
      if (!s.isCertain('meridiem')) {
        if (partWord && ['afternoon', 'evening', 'night', 'tonight'].includes(partWord) && h < 12) h += 12;
        else if (h >= 1 && h <= 7) h += 12;
      }
      time = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
    }
    cut(st, r.index, r.index + r.text.length);
  }

  // 7. A day of the month on its own ("before the 10th")
  const od = st.text.match(new RegExp(`\\b(?:the )?(\\d{1,2})(?:st|nd|rd|th)\\b(?! ${MONTHS})(?: of (?:the |every |each )?month)?`, 'i'));
  if (od && od.index !== undefined) {
    const n = Number(od[1]);
    if (n >= 1 && n <= 31) {
      if (repeat && /^FREQ=MONTHLY/.test(repeat) && !/BYDAY|BYMONTHDAY/.test(repeat)) repeat += `;BYMONTHDAY=${n}`;
      else if (!due) due = nextMonthDay(today, n);
      cut(st, od.index, od.index + od[0].length);
    }
  }
  if (/\bof (?:every|each) month\b/i.test(st.text) && !repeat) {
    // "on the 5th of every month" where the ordinal came first
    const m = st.text.match(/\bof (?:every|each) month\b/i)!;
    repeat = 'FREQ=MONTHLY';
    if (due) { repeat += `;BYMONTHDAY=${due.d}`; due = null; }
    cut(st, m.index!, m.index! + m[0].length);
  }

  if (!time && partTime) time = partTime;
  if (repeat && /^FREQ=WEEKLY/.test(repeat) && !/BYDAY/.test(repeat) && anchor) repeat += `;BYDAY=${RRULE_DAYS[weekday(anchor)]}`;
  if (repeat && /^FREQ=MONTHLY$/.test(repeat) && anchor) repeat += `;BYMONTHDAY=${anchor.d}`;
  if (time && !due && !repeat) due = (Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) > nowMin) ? today : addDays(today, 1);

  let dueStr = due ? fmt(due) : null;
  if (repeat) dueStr = nextOccurrence(repeat, today, nowMin, time, anchor && !/BYDAY|BYMONTHDAY/.test(repeat) ? anchor : null) ?? dueStr;

  const title = cleanTitle(st.text);

  // Confidence: how likely this parse is right without the AI
  let confidence = 0.92 - penalty;
  const words = title.split(/\s+/).filter(Boolean);
  if (!title) confidence = 0.2;
  if (hasDevanagari(phrase)) confidence = Math.min(confidence, 0.3);
  if (words.length >= 9) confidence -= 0.25;
  if (/\b(?:and|aur)\b/i.test(title) && words.length >= 6) confidence -= 0.2;
  if (new RegExp(`\\b(?:${WD}|${MONTHS}|tomorrow|today|tonight|baje|o'?clock|\\d{1,2}\\s*(?:am|pm)|next|last|weekly|monthly|every|alternate|fortnight)\\b`, 'i').test(title)) confidence -= 0.35;
  if (/\b(?:after|before|until|till|around|between|except|unless|if|when)\b/i.test(title)) confidence -= 0.25;
  if (/\b(?:needs?|has to be|have to be|should be|must be)\b/i.test(title) && !startsWithVerb(title)) confidence -= 0.3;
  if (/\d/.test(title) && !/\b\d+\s*(?:kg|litre|liter|l|gm|g|pcs|packets?|rs|₹|units?|x)\b/i.test(title)) confidence -= 0.1;

  return {
    title,
    due: dueStr,
    time,
    repeat,
    priority,
    tags: tagsFor(title),
    confidence: Math.max(0, Math.min(1, Number(confidence.toFixed(2)))),
    question: null,
  };
}

function findRepeat(text: string): { rule: string; start: number; end: number; time?: string; partWord?: string } | null {
  const dayCode = (w: string) => RRULE_DAYS[WEEKDAYS.indexOf(w.toLowerCase().replace(/s$/, '') as typeof WEEKDAYS[number])];
  const tries: [RegExp, (m: RegExpMatchArray) => { rule: string; time?: string; partWord?: string }][] = [
    [new RegExp(`\\b(?:every other|alternate) ${WD}s?\\b`, 'i'), (m) => ({ rule: `FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayCode(m[1])}` })],
    [new RegExp(`\\b(?:every|each|har)\\s+(first|second|third|fourth|last|1st|2nd|3rd|4th|pehle|dusre|teesre)\\s+${WD}(?:\\s+of\\s+(?:the|every|each)\\s+month)?\\b`, 'i'), (m) => {
      const n = ({ first: 1, '1st': 1, pehle: 1, second: 2, '2nd': 2, dusre: 2, third: 3, '3rd': 3, teesre: 3, fourth: 4, '4th': 4, last: -1 } as Record<string, number>)[m[1].toLowerCase()];
      return { rule: `FREQ=MONTHLY;BYDAY=${n}${dayCode(m[2])}` };
    }],
    [new RegExp(`\\b(?:on )?(?:the )?(first|second|third|fourth|last|1st|2nd|3rd|4th)\\s+${WD}\\s+of\\s+(?:every|each)\\s+month\\b`, 'i'), (m) => {
      const n = ({ first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, last: -1 } as Record<string, number>)[m[1].toLowerCase()];
      return { rule: `FREQ=MONTHLY;BYDAY=${n}${dayCode(m[2])}` };
    }],
    [/\b(?:every|on) weekdays?\b/i, () => ({ rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' })],
    [/\b(?:every|on) weekends?\b/i, () => ({ rule: 'FREQ=WEEKLY;BYDAY=SA,SU' })],
    [new RegExp(`\\b(?:every|each)\\s+${WD}s?((?:\\s*(?:,|and|&)\\s*${WD}s?)*)\\b`, 'i'), (m) => {
      const all = m[0].match(new RegExp(WD, 'gi'))!.map(dayCode);
      return { rule: `FREQ=WEEKLY;BYDAY=${[...new Set(all)].join(',')}` };
    }],
    [new RegExp(`\\bon ${WD}s\\b`, 'i'), (m) => ({ rule: `FREQ=WEEKLY;BYDAY=${dayCode(m[1])}` })],
    [/\bevery (\d+) (day|week|month|year)s?\b/i, (m) => ({ rule: `FREQ=${({ day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY', year: 'YEARLY' } as Record<string, string>)[m[2].toLowerCase()]};INTERVAL=${m[1]}` })],
    [/\bevery fortnight\b|\bfortnightly\b|\bevery other week\b|\balternate weeks\b/i, () => ({ rule: 'FREQ=WEEKLY;INTERVAL=2' })],
    [/\bevery other day\b|\balternate days?\b|\bevery second day\b/i, () => ({ rule: 'FREQ=DAILY;INTERVAL=2' })],
    [/\bevery (morning|afternoon|evening|night)\b/i, (m) => ({ rule: 'FREQ=DAILY', time: PART_OF_DAY[m[1].toLowerCase()], partWord: m[1].toLowerCase() })],
    [/\bevery\s+day\b/i, () => ({ rule: 'FREQ=DAILY' })],
    [/\b(?:every week|weekly)\b/i, () => ({ rule: 'FREQ=WEEKLY' })],
    [/\b(?:every month|monthly)\b/i, () => ({ rule: 'FREQ=MONTHLY' })],
    [/\b(?:every year|yearly|annually)\b/i, () => ({ rule: 'FREQ=YEARLY' })],
  ];
  for (const [re, make] of tries) {
    const m = text.match(re);
    if (m && m.index !== undefined) return { ...make(m), start: m.index, end: m.index + m[0].length };
  }
  return null;
}

export function tagsFor(title: string): string[] {
  return TAG_WORDS.filter(([, re]) => re.test(title)).map(([t]) => t).slice(0, 2);
}
