// Finds the words in what was said that carry a date, time, repeat or priority,
// so the transcript can show what SayDo understood as you speak.

export type MarkKind = 'when' | 'repeat' | 'priority';
export interface Piece { text: string; kind?: MarkKind }

const WD = 'sunday|monday|tuesday|wednesday|thursday|friday|saturday|som(?:v|w)aa?r|mangal(?:v|w)aa?r|budh(?:v|w)aa?r|guru(?:v|w)aa?r|shukra?(?:v|w)aa?r|shani(?:v|w)aa?r|ravi(?:v|w)aa?r';
const MON = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

const PATTERNS: [MarkKind, RegExp][] = [
  ['repeat', new RegExp(`\\b(?:every|each|har)\\s+(?:other\\s+|alternate\\s+|second\\s+|first\\s+|third\\s+|last\\s+|\\d+(?:st|nd|rd|th)?\\s+)?(?:${WD}|day|week|month|year|morning|evening|night|weekday|weekend)s?(?:\\s+(?:and|&)\\s+(?:${WD})s?)*(?:\\s+of\\s+(?:the|every|each)\\s+month)?\\b|\\b(?:daily|weekly|monthly|yearly|roz|rozana|of every month|every other day)\\b`, 'gi')],
  ['priority', /\b(?:urgent(?:ly)?|asap|important|zaroori|jaldi|sometime|whenever|no rush)\b/gi],
  ['when', new RegExp(`\\b(?:(?:before|by|on|at|this|next|coming)\\s+)?(?:today|tomorrow|tonight|aaj|kal|parso[n]?|day after tomorrow|next week|next month|this weekend|end of (?:the )?month|agle hafte|agle mahine|${WD}|morning|afternoon|evening|night|noon|subah|shaam|dopahar|raat|\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)|\\d{1,2}\\s*baje|\\d{1,2}(?:st|nd|rd|th)(?:\\s+(?:of\\s+)?(?:${MON}))?|\\d{1,2}\\s+tarikh|(?:${MON})\\s+\\d{1,2}|\\d{1,2}\\s+(?:${MON})|at\\s+\\d{1,2}(?::\\d{2})?|in\\s+\\d+\\s+(?:days?|hours?|weeks?))\\b(?:\\s+(?:se pehle|tak|ko))?`, 'gi')],
];

export function highlight(text: string): Piece[] {
  const marks: { start: number; end: number; kind: MarkKind }[] = [];
  for (const [kind, re] of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0, end = start + m[0].length;
      if (!marks.some((x) => start < x.end && end > x.start)) marks.push({ start, end, kind });
    }
  }
  marks.sort((a, b) => a.start - b.start);
  const out: Piece[] = [];
  let at = 0;
  for (const mk of marks) {
    if (mk.start > at) out.push({ text: text.slice(at, mk.start) });
    out.push({ text: text.slice(mk.start, mk.end), kind: mk.kind });
    at = mk.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
