import { Attendance, Helper, LedgerEntry, STATUS_WEIGHT } from './types';
import {
  datesInPeriod,
  dayOfWeek,
  periodBounds,
  toDateKey,
  todayKey,
} from './dates';

/**
 * Fixed 30-day divisor: a monthly helper's day rate is salary / 30 in every
 * month, so a February absence costs the same as an August one. This is the
 * convention households actually speak in ("9000 a month, so 300 a day").
 */
export const MONTHLY_DIVISOR = 30;

export interface PayrollBreakdown {
  period: string;
  helperId: number;
  dayRatePaise: number;
  /** Days with an explicit mark, grouped. */
  counts: Record<string, number>;
  markedDays: number;
  unmarkedDays: number;
  /** Sum of status weights over marked days only. */
  payableDays: number;
  earnedPaise: number;
  /** What they would earn if every unmarked day were marked present. */
  potentialPaise: number;
  advancesPaise: number;
  bonusesPaise: number;
  finesPaise: number;
  netPayablePaise: number;
  unmarkedDateKeys: string[];
  /** First and last day of the period the engagement actually covers. */
  windowStart: string;
  windowEnd: string;
  /** Calendar days of the period inside the engagement window. */
  engagedDays: number;
  /** True when the engagement covers only part of the month. */
  isPartialMonth: boolean;
  /** Engaged days still ahead of today; excluded from every total. */
  futureDays: number;
  /** Units delivered this period, for per_unit workers. */
  totalQuantity: number;
}

export function dayRatePaise(helper: Helper): number {
  switch (helper.salary_type) {
    case 'monthly':
      return Math.round(helper.salary_paise / MONTHLY_DIVISOR);
    case 'daily':
      return helper.salary_paise;
    case 'hourly':
      // An hourly helper's "day" is only meaningful via hours_worked; the
      // day rate is the hourly rate and hours are applied per entry.
      return helper.salary_paise;
    case 'per_unit':
      // Rate for one unit. The day's pay is this times the quantity.
      return helper.salary_paise;
  }
}

export function parseWeeklyOffs(helper: Helper): number[] {
  return helper.weekly_offs
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

/**
 * Unmarked days are excluded from the payout rather than assumed present,
 * so `earnedPaise` only ever reflects days you actually confirmed. The
 * caller surfaces `unmarkedDays` so the number is never silently low.
 */
export function computePayroll(
  helper: Helper,
  period: string,
  attendance: Attendance[],
  ledger: LedgerEntry[],
): PayrollBreakdown {
  const rate = dayRatePaise(helper);
  const offs = parseWeeklyOffs(helper);
  const byDate = new Map(attendance.map((a) => [a.date, a]));

  const counts: Record<string, number> = {};
  let payableDays = 0;
  let markedDays = 0;
  const unmarkedDateKeys: string[] = [];
  let potentialDays = 0;
  let windowStart = '';
  let windowEnd = '';
  let engagedDays = 0;
  let futureDays = 0;
  let totalQuantity = 0;

  const allDates = datesInPeriod(period);
  const today = todayKey();

  for (const dateKey of allDates) {
    // A day only counts if it falls inside the engagement: on or after the
    // start date, and on or before whichever of end_date / archived_at comes
    // first. This is what pro-rates a helper kept for only part of a month.
    if (dateKey < helper.start_date) continue;
    if (helper.end_date && dateKey > helper.end_date) continue;
    if (helper.archived_at && dateKey > helper.archived_at) continue;

    if (!windowStart) windowStart = dateKey;
    windowEnd = dateKey;
    engagedDays += 1;

    // A day that has not happened yet is neither worked nor missing data.
    // Counting it as "unmarked" nags about days nobody can mark, and letting
    // the bulk fill touch it would pay wages for work not yet done.
    if (dateKey > today) {
      futureDays += 1;
      continue;
    }

    const mark = byDate.get(dateKey);
    if (mark) {
      const weight =
        helper.salary_type === 'hourly' && mark.hours_worked != null
          ? mark.hours_worked
          : STATUS_WEIGHT[mark.status];
      counts[mark.status] = (counts[mark.status] ?? 0) + 1;
      payableDays += weight;
      potentialDays += weight;
      markedDays += 1;

      // For a per-unit worker the quantity carries the pay, so a day with no
      // recorded quantity falls back to their usual daily amount. The status
      // weight still applies, so an absent day contributes nothing.
      if (helper.salary_type === 'per_unit') {
        const qty = mark.quantity ?? helper.default_quantity ?? 0;
        totalQuantity += qty * STATUS_WEIGHT[mark.status];
      }
    } else if (offs.includes(dayOfWeek(dateKey))) {
      // An unmarked weekly off is implied, not missing data.
      counts.week_off = (counts.week_off ?? 0) + 1;
      payableDays += STATUS_WEIGHT.week_off;
      potentialDays += STATUS_WEIGHT.week_off;
      markedDays += 1;
    } else {
      unmarkedDateKeys.push(dateKey);
      potentialDays += 1;
    }
  }

  const isPerUnit = helper.salary_type === 'per_unit';
  const earnedPaise = isPerUnit
    ? Math.round(rate * totalQuantity)
    : Math.round(rate * payableDays);
  const potentialPaise = isPerUnit
    ? Math.round(rate * totalQuantity)
    : Math.round(rate * potentialDays);

  let advancesPaise = 0;
  let bonusesPaise = 0;
  let finesPaise = 0;

  for (const entry of ledger) {
    switch (entry.type) {
      case 'advance':
      case 'loan':
        advancesPaise += entry.amount_paise;
        break;
      case 'repayment':
        advancesPaise -= entry.amount_paise;
        break;
      case 'bonus':
      case 'reimbursement':
        bonusesPaise += entry.amount_paise;
        break;
      case 'fine':
        finesPaise += entry.amount_paise;
        break;
    }
  }

  return {
    period,
    helperId: helper.id,
    dayRatePaise: rate,
    counts,
    markedDays,
    unmarkedDays: unmarkedDateKeys.length,
    payableDays,
    earnedPaise,
    potentialPaise,
    advancesPaise,
    bonusesPaise,
    finesPaise,
    netPayablePaise: earnedPaise + bonusesPaise - finesPaise - advancesPaise,
    unmarkedDateKeys,
    windowStart: windowStart || periodBounds(period).start,
    windowEnd: windowEnd || periodBounds(period).end,
    engagedDays,
    isPartialMonth: engagedDays > 0 && engagedDays < allDates.length,
    futureDays,
    totalQuantity,
  };
}

/**
 * Resolves "keeping them for N days / N months" into an inclusive end date.
 * A 1-month engagement starting on the 10th ends on the 9th of the next
 * month, which is how a household counts a month — not 30 fixed days.
 */
export function engagementEndDate(
  startDateKey: string,
  amount: number,
  unit: 'days' | 'months',
): string {
  const [y, m, d] = startDateKey.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end =
    unit === 'days'
      ? new Date(y, m - 1, d + amount - 1)
      : new Date(y, m - 1 + amount, d - 1);
  // Guard against a rolled-over date when the target month is shorter.
  if (unit === 'months' && end < start) return startDateKey;
  return toDateKey(end);
}
