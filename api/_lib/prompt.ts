import { z } from 'zod';
import { localParts, WEEKDAYS } from '../../src/core/dates';
import { tagsFor } from '../../src/core/parse';
import { nextOccurrence } from '../../src/core/repeat';
import type { ParsedTask } from '../../src/core/types';

export const PROMPT_VERSION = 'parse-v3';

export function systemPrompt(now: Date, timeZone: string): string {
  const p = localParts(now, timeZone);
  const today = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  const wd = WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  const time = `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}`;
  return `You turn what someone said into to-do tasks. They may speak English, Hindi (Devanagari or Roman script) or a mix (Hinglish).
Right now it is ${wd} ${today}, ${time}, time zone ${timeZone}.

Return JSON: {"tasks": [{"title": string, "due": "YYYY-MM-DD" | null, "time": "HH:mm" | null, "repeat": string | null, "priority": "high" | "normal" | "low", "question": string | null}]}

Rules:
- One task per separate thing to do. A shopping list ("milk, eggs and bread") is one task.
- title: short and starting with the action, in the speaker's own language and script. Drop the date and time words and fillers like "remind me to", "mujhe", "yaad dilana", "hai". Rephrase passive wording into an action ("the cylinder needs booking" → "Book the gas cylinder").
- Times: morning 09:00, noon 12:00, afternoon 14:00, evening 18:00, night or tonight 21:00. A bare hour 1–7 means pm, 8–11 means am, unless the meaning is clearly otherwise (waking up at 6 is 06:00). A range ("between 2 and 4") uses its start.
- Dates: "before X" or "by X" means due X. A day of the month alone ("the 10th") is its next occurrence. A weekday alone is the next one after today; "next <weekday>" is the coming one; "next to next <weekday>" is the one after that. "next week" is next Monday. "next month" is the 1st of next month. "end of the month" or "last day of the month" is its last day. "kal" means tomorrow, "parson" the day after.
- If only a time is given, due is today if that time is still ahead, otherwise tomorrow.
- repeat: an iCalendar RRULE body without "RRULE:", e.g. FREQ=DAILY, FREQ=WEEKLY;BYDAY=MO,TH, FREQ=WEEKLY;INTERVAL=2;BYDAY=SU, FREQ=MONTHLY;BYMONTHDAY=5, FREQ=MONTHLY;BYDAY=2SA (second Saturday), FREQ=MONTHLY;BYDAY=-1FR (last Friday). "every second Saturday" means the second Saturday of each month. For a repeating task, due is its next occurrence.
- priority: high for urgent, asap, important, zaroori, jaldi; low for sometime, whenever, no rush; otherwise normal.
- question: only if something essential is genuinely unclear; otherwise null.
Return only the JSON.`;
}

const TaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().default(null),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional().default(null),
  repeat: z.string().max(120).nullable().optional().default(null),
  priority: z.enum(['high', 'normal', 'low']).optional().default('normal'),
  question: z.string().max(200).nullable().optional().default(null),
});
const ReplySchema = z.object({ tasks: z.array(TaskSchema).max(12) });

/** Validates the model's reply, then lets code (not the model) do the calendar arithmetic for repeats. */
export function toTasks(raw: unknown, now: Date, timeZone: string): ParsedTask[] {
  const reply = ReplySchema.parse(raw);
  const p = localParts(now, timeZone);
  const today = { y: p.y, m: p.m, d: p.d };
  return reply.tasks.map((t) => {
    const repeat = t.repeat ? t.repeat.replace(/^RRULE:/i, '').toUpperCase().trim() : null;
    const due = repeat ? nextOccurrence(repeat, today, p.hh * 60 + p.mm, t.time ?? null) ?? t.due ?? null : t.due ?? null;
    return {
      title: t.title[0].toUpperCase() + t.title.slice(1),
      due, time: t.time ?? null, repeat, priority: t.priority ?? 'normal',
      tags: tagsFor(t.title), confidence: t.question ? 0.6 : 0.9, question: t.question ?? null,
    };
  });
}
