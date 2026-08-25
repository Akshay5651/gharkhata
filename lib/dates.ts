/**
 * Dates are plain local YYYY-MM-DD strings. Never use toISOString() here:
 * at IST (+5:30) it reports the previous day for anything before 05:30.
 */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const todayKey = (): string => toDateKey(new Date());

/**
 * Parses a date key in local time. `new Date('2026-08-25')` is parsed as UTC
 * midnight, which is a different instant from local midnight — building the
 * Date from parts keeps it on the intended day everywhere.
 */
export function fromDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Period is YYYY-MM. */
export const toPeriod = (dateKey: string): string => dateKey.slice(0, 7);

export const currentPeriod = (): string => toPeriod(todayKey());

export function periodBounds(period: string): { start: string; end: string } {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${period}-01`, end: `${period}-${String(last).padStart(2, '0')}` };
}

export function daysInPeriod(period: string): number {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Every YYYY-MM-DD in the period, in order. */
export function datesInPeriod(period: string): string[] {
  const total = daysInPeriod(period);
  return Array.from(
    { length: total },
    (_, i) => `${period}-${String(i + 1).padStart(2, '0')}`,
  );
}

/** JS day index (0 = Sunday) for a date key, computed in local time. */
export function dayOfWeek(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Every YYYY-MM from start to end, inclusive, in order. */
export function periodsBetween(startPeriod: string, endPeriod: string): string[] {
  const out: string[] = [];
  let p = startPeriod;
  // A guard against a corrupted start_date sending this well past a lifetime
  // of months — 100 years is generous and keeps a bad date from hanging.
  for (let i = 0; p <= endPeriod && i < 1200; i++) {
    out.push(p);
    p = shiftPeriod(p, 1);
  }
  return out;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}
