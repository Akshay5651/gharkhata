import { Helper } from './types';
import {
  getAllPayments,
  getAttendanceForPeriod,
  getLedgerForPeriod,
} from './db';
import { computePayroll } from './salary';
import { currentPeriod, periodsBetween, toPeriod } from './dates';

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
 */
export function computeWorkerBalance(helper: Helper): WorkerBalance {
  const startPeriod = toPeriod(helper.start_date);
  const endPeriod = helper.archived_at
    ? toPeriod(helper.archived_at)
    : currentPeriod();

  let totalDuePaise = 0;
  for (const period of periodsBetween(startPeriod, endPeriod)) {
    const payroll = computePayroll(
      helper,
      period,
      getAttendanceForPeriod(helper.id, period),
      getLedgerForPeriod(helper.id, period),
    );
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
