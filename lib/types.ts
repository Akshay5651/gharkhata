/**
 * `per_unit` covers the milkman case: pay is rate × quantity delivered that
 * day, and the quantity changes daily, so it lives on the attendance row
 * rather than on the worker.
 */
export type SalaryType = 'monthly' | 'daily' | 'hourly' | 'per_unit';

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'half_day'
  | 'paid_leave'
  | 'week_off'
  | 'holiday';

export type LedgerType =
  | 'advance'
  | 'loan'
  | 'repayment'
  | 'bonus'
  | 'fine'
  | 'reimbursement';

export interface Helper {
  id: number;
  name: string;
  role: string;
  phone: string | null;
  /** UPI VPA (name@bank), for the "pay via UPI" deep link. Optional. */
  upi_id: string | null;
  photo_uri: string | null;
  salary_paise: number;
  salary_type: SalaryType;
  /** Unit name for per_unit workers: kg, litre, piece. */
  unit_label: string | null;
  /** Pre-filled quantity so the common day is one tap. */
  default_quantity: number | null;
  /** CSV of JS day indices that are weekly offs, e.g. "0" for Sunday. */
  weekly_offs: string;
  paid_leaves_per_month: number;
  start_date: string;
  /** Last day of a fixed-term engagement. null = ongoing, no end date. */
  end_date: string | null;
  is_active: number;
  created_at: string;
  archived_at: string | null;
}

export interface Attendance {
  id: number;
  helper_id: number;
  date: string;
  status: AttendanceStatus;
  hours_worked: number | null;
  /** Units delivered that day, for per_unit workers. */
  quantity: number | null;
  note: string | null;
  marked_at: string;
}

export interface LedgerEntry {
  id: number;
  helper_id: number;
  date: string;
  type: LedgerType;
  amount_paise: number;
  note: string | null;
  created_at: string;
}

export interface Payment {
  id: number;
  helper_id: number;
  period: string;
  paid_on: string;
  amount_paise: number;
  method: 'cash' | 'upi' | 'bank';
  note: string | null;
}

/** How much of a day's wage each status earns. */
export const STATUS_WEIGHT: Record<AttendanceStatus, number> = {
  present: 1,
  absent: 0,
  half_day: 0.5,
  paid_leave: 1,
  week_off: 1,
  holiday: 1,
};

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half day',
  paid_leave: 'Paid leave',
  week_off: 'Week off',
  holiday: 'Holiday',
};
