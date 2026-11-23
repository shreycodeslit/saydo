// Calendar helpers that work on plain local dates ("2026-11-23") in the user's time zone,
// so a task said in India at 11pm is never shifted to the next day by UTC conversions.

export interface Ymd { y: number; m: number; d: number }

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
export const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

export function localParts(now: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute };
}

/** Minutes east of UTC for this zone at this instant (India = 330). */
export function offsetMinutes(now: Date, timeZone: string): number {
  const p = localParts(now, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
  return Math.round((asUtc - Math.floor(now.getTime() / 60000) * 60000) / 60000);
}

export const toUtc = (x: Ymd) => new Date(Date.UTC(x.y, x.m - 1, x.d));
export const fromUtc = (dt: Date): Ymd => ({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
export const fmt = (x: Ymd) => `${x.y}-${String(x.m).padStart(2, '0')}-${String(x.d).padStart(2, '0')}`;
export const parseYmd = (s: string): Ymd => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
export const addDays = (x: Ymd, n: number): Ymd => { const t = toUtc(x); t.setUTCDate(t.getUTCDate() + n); return fromUtc(t); };
export const weekday = (x: Ymd) => toUtc(x).getUTCDay();
export const sameDay = (a: Ymd, b: Ymd) => a.y === b.y && a.m === b.m && a.d === b.d;
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The next date (after today) that falls on the given weekday, 0 = Sunday. */
export function nextWeekday(today: Ymd, day: number, includeToday = false): Ymd {
  let diff = (day - weekday(today) + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  return addDays(today, diff);
}

/** The next time the given day of the month comes round (the 10th → 10 Dec when today is 23 Nov). */
export function nextMonthDay(today: Ymd, day: number): Ymd {
  let { y, m } = today;
  if (day <= today.d) { m += 1; if (m > 12) { m = 1; y += 1; } }
  for (let i = 0; i < 12; i++) {
    if (day <= daysInMonth(y, m)) return { y, m, d: day };
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return { y, m, d: daysInMonth(y, m) };
}

export function friendlyDate(due: string | null, today: Ymd): string {
  if (!due) return '';
  const d = parseYmd(due);
  const diff = Math.round((toUtc(d).getTime() - toUtc(today).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const dt = toUtc(d);
  const opts: Intl.DateTimeFormatOptions = diff > 1 && diff < 7
    ? { weekday: 'long', timeZone: 'UTC' }
    : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC', ...(d.y !== today.y ? { year: 'numeric' } : {}) };
  return new Intl.DateTimeFormat('en-IN', opts).format(dt);
}

export function friendlyTime(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ap}` : `${h12} ${ap}`;
}
