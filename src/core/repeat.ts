import * as rrulePkg from 'rrule';
import { fmt, fromUtc, type Ymd } from './dates';

// rrule ships CommonJS for Node and ESM for browsers; this works with both
const rruleMod = rrulePkg as unknown as Record<string, { RRule?: unknown } | undefined> & { RRule?: unknown };
const RRule = (rruleMod.RRule ?? Reflect.get(rruleMod, 'default')?.RRule) as typeof import('rrule').RRule;

const DAY_NAMES: Record<string, string> = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' };
const NTH: Record<string, string> = { '1': 'first', '2': 'second', '3': 'third', '4': 'fourth', '-1': 'last' };

export function ruleParts(rule: string): Record<string, string> {
  return Object.fromEntries(rule.split(';').filter(Boolean).map((kv) => { const [k, v] = kv.split('='); return [k.toUpperCase(), (v || '').toUpperCase()]; }));
}

/** Same rule written differently ("BYDAY=SA;FREQ=WEEKLY" vs "FREQ=WEEKLY;BYDAY=SA") compares equal. */
export function sameRule(a: string | null, b: string | null): boolean {
  if (!a || !b) return !a && !b;
  const pa = ruleParts(a), pb = ruleParts(b);
  if (pa.INTERVAL === '1') delete pa.INTERVAL;
  if (pb.INTERVAL === '1') delete pb.INTERVAL;
  const keys = new Set([...Object.keys(pa), ...Object.keys(pb)]);
  for (const k of keys) {
    const va = (pa[k] || '').split(',').sort().join(','), vb = (pb[k] || '').split(',').sort().join(',');
    if (va !== vb) return false;
  }
  return true;
}

/** "FREQ=MONTHLY;BYDAY=2SA" → "Every second Saturday of the month" */
export function describeRule(rule: string | null): string {
  if (!rule) return '';
  const p = ruleParts(rule);
  const n = Number(p.INTERVAL || 1);
  const days = (p.BYDAY || '').split(',').filter(Boolean);
  const plain = days.filter((d) => /^[A-Z]{2}$/.test(d));
  switch (p.FREQ) {
    case 'DAILY': return n > 1 ? `Every ${n} days` : 'Every day';
    case 'WEEKLY': {
      if (plain.length === 5 && !plain.includes('SA') && !plain.includes('SU')) return 'Every weekday';
      if (plain.length === 2 && plain.includes('SA') && plain.includes('SU')) return 'Every weekend';
      const list = plain.map((d) => DAY_NAMES[d]).join(' and ');
      if (n === 2) return list ? `Every other ${list}` : 'Every 2 weeks';
      if (n > 2) return `Every ${n} weeks${list ? ` on ${list}` : ''}`;
      return list ? `Every ${list}` : 'Every week';
    }
    case 'MONTHLY': {
      const nth = days.find((d) => /^-?\d[A-Z]{2}$/.test(d));
      if (nth) { const m = nth.match(/^(-?\d)([A-Z]{2})$/)!; return `Every ${NTH[m[1]] || m[1]} ${DAY_NAMES[m[2]]} of the month`; }
      if (p.BYMONTHDAY) return `Every month on the ${ordinal(Number(p.BYMONTHDAY))}`;
      return n > 1 ? `Every ${n} months` : 'Every month';
    }
    case 'YEARLY': return 'Every year';
    default: return 'Repeats';
  }
}

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * First occurrence of a repeating task that is still ahead of `now`.
 * Local wall-clock times are treated as UTC throughout, so no time zone can shift the day.
 */
export function nextOccurrence(rule: string, today: Ymd, nowMinutes: number, time: string | null, anchor?: Ymd | null): string | null {
  try {
    const [hh, mm] = time ? time.split(':').map(Number) : [23, 59];
    const start = anchor ?? today;
    const dtstart = new Date(Date.UTC(start.y, start.m - 1, start.d, hh, mm));
    const r = new RRule({ ...RRule.parseString(rule), dtstart });
    const nowUtc = new Date(Date.UTC(today.y, today.m - 1, today.d, Math.floor(nowMinutes / 60), nowMinutes % 60));
    const next = r.after(nowUtc, true);
    return next ? fmt(fromUtc(next)) : null;
  } catch {
    return null;
  }
}
