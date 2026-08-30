import { Attendance, Helper, LedgerEntry } from './types';
import { getAllAttendance, getAllLedgerEntries, getAllPayments } from './db';
import { computePayroll } from './salary';
import { currentPeriod, periodBounds, periodsBetween, toPeriod } from './dates';

export interface WorkerBalance {
  /** Sum of every month's net payable, from hire date to now. */
  totalDuePaise: number;
  /** Sum of every payment ever recorded. */
  totalPaidPaise: number;
  /** What's still owed. Negative means the worker was overpaid. */
  balancePaise: number;
}

/**
 * A running khata balance rather than month-by-month reconciliation: "carry
 * forward" falls out for free because this is just a lifetime total, not a
 * per-period one. Paying less than a month's net payable leaves the gap in
 * the balance automatically, and it stays there until a payment closes it —
 * no explicit carry-forward bookkeeping needed anywhere else.
 *
 * Fetches attendance and ledger ONCE for the worker's whole history rather
 * than once per month — a worker with two years of history previously meant
 * ~48 separate queries every time this ran (called for every worker on every
 * Salary screen load). computePayroll() itself doesn't filter by period —
 * it sums whatever ledger rows it's handed unconditionally — so the
 * per-period slice has to happen here in JS instead of via SQL WHERE, using
 * plain string comparison since date keys are YYYY-MM-DD (lexicographic
 * order matches chronological order, same convention used throughout).
 */
export function computeWorkerBalance(helper: Helper): WorkerBalance {
  const startPeriod = toPeriod(helper.start_date);
  const endPeriod = helper.archived_at
    ? toPeriod(helper.archived_at)
    : currentPeriod();

  const allAttendance = getAllAttendance(helper.id);
  const allLedger = getAllLedgerEntries(helper.id);

  let totalDuePaise = 0;
  for (const period of periodsBetween(startPeriod, endPeriod)) {
    const { start, end } = periodBounds(period);
    const attendance = allAttendance.filter(
      (a: Attendance) => a.date >= start && a.date <= end,
    );
    const ledger = allLedger.filter(
      (l: LedgerEntry) => l.date >= start && l.date <= end,
    );
    const payroll = computePayroll(helper, period, attendance, ledger);
    totalDuePaise += payroll.netPayablePaise;
  }

  const totalPaidPaise = getAllPayments(helper.id).reduce(
    (sum, p) => sum + p.amount_paise,
    0,
  );

  return {
    totalDuePaise,
    totalPaidPaise,
    balancePaise: totalDuePaise - totalPaidPaise,
  };
}
