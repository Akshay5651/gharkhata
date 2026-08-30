import * as SQLite from 'expo-sqlite';
import {
  Attendance,
  AttendanceStatus,
  Helper,
  LedgerEntry,
  LedgerType,
  Payment,
} from './types';
import { periodBounds, todayKey } from './dates';

const DB_NAME = 'gharkhata.db';

let db: SQLite.SQLiteDatabase | null = null;

const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE helper (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    phone TEXT,
    photo_uri TEXT,
    salary_paise INTEGER NOT NULL DEFAULT 0,
    salary_type TEXT NOT NULL DEFAULT 'monthly',
    weekly_offs TEXT NOT NULL DEFAULT '',
    paid_leaves_per_month INTEGER NOT NULL DEFAULT 0,
    start_date TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    archived_at TEXT
  );

  CREATE TABLE attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    helper_id INTEGER NOT NULL REFERENCES helper(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    hours_worked REAL,
    note TEXT,
    marked_at TEXT NOT NULL,
    UNIQUE(helper_id, date)
  );
  CREATE INDEX idx_attendance_helper_date ON attendance(helper_id, date);

  CREATE TABLE ledger_entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    helper_id INTEGER NOT NULL REFERENCES helper(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_ledger_helper_date ON ledger_entry(helper_id, date);

  CREATE TABLE payment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    helper_id INTEGER NOT NULL REFERENCES helper(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    paid_on TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    method TEXT NOT NULL DEFAULT 'cash',
    note TEXT
  );
  CREATE INDEX idx_payment_helper_period ON payment(helper_id, period);

  CREATE TABLE payroll_snapshot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    helper_id INTEGER NOT NULL REFERENCES helper(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    computed_json TEXT NOT NULL,
    settled_at TEXT NOT NULL,
    UNIQUE(helper_id, period)
  );

  CREATE TABLE app_setting (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // v2 — fixed-term engagements ("keeping the majdoor for 12 days")
  `ALTER TABLE helper ADD COLUMN end_date TEXT;`,
  // v3 — per-unit pay: the milkman is paid rate × kg/litres delivered
  `
  ALTER TABLE helper ADD COLUMN unit_label TEXT;
  ALTER TABLE helper ADD COLUMN default_quantity REAL;
  ALTER TABLE attendance ADD COLUMN quantity REAL;
  `,
  // v4 — optional UPI ID for the "pay via UPI" deep link
  `ALTER TABLE helper ADD COLUMN upi_id TEXT;`,
];

/**
 * user_version drives migrations: each array entry is one version step, so
 * shipped installs upgrade by running only the steps they haven't seen.
 */
export function initDb(): SQLite.SQLiteDatabase {
  if (db) return db;
  db = SQLite.openDatabaseSync(DB_NAME);
  db.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  for (let i = version; i < MIGRATIONS.length; i++) {
    db.execSync(MIGRATIONS[i]);
    version = i + 1;
  }
  db.execSync(`PRAGMA user_version = ${version}`);
  return db;
}

const conn = (): SQLite.SQLiteDatabase => db ?? initDb();

/* ---------- helpers ---------- */

export function listHelpers(includeArchived = false): Helper[] {
  const where = includeArchived ? '' : 'WHERE is_active = 1';
  return conn().getAllSync<Helper>(
    `SELECT * FROM helper ${where} ORDER BY name COLLATE NOCASE`,
  );
}

export function getHelper(id: number): Helper | null {
  return conn().getFirstSync<Helper>('SELECT * FROM helper WHERE id = ?', id);
}

export function createHelper(input: {
  name: string;
  role?: string;
  phone?: string | null;
  upi_id?: string | null;
  photo_uri?: string | null;
  salary_paise: number;
  salary_type?: Helper['salary_type'];
  weekly_offs?: string;
  paid_leaves_per_month?: number;
  start_date?: string;
  end_date?: string | null;
  unit_label?: string | null;
  default_quantity?: number | null;
}): number {
  const result = conn().runSync(
    `INSERT INTO helper
       (name, role, phone, upi_id, photo_uri, salary_paise, salary_type, weekly_offs,
        paid_leaves_per_month, start_date, end_date, unit_label,
        default_quantity, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.name.trim(),
    input.role ?? '',
    input.phone ?? null,
    input.upi_id ?? null,
    input.photo_uri ?? null,
    input.salary_paise,
    input.salary_type ?? 'monthly',
    input.weekly_offs ?? '',
    input.paid_leaves_per_month ?? 0,
    input.start_date ?? todayKey(),
    input.end_date ?? null,
    input.unit_label ?? null,
    input.default_quantity ?? null,
    new Date().toISOString(),
  );
  return result.lastInsertRowId;
}

/** Active helpers count, for enforcing the free-tier cap. */
export function activeHelperCount(): number {
  const row = conn().getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM helper WHERE is_active = 1',
  );
  return row?.n ?? 0;
}

const HELPER_COLUMNS = new Set([
  'name',
  'role',
  'phone',
  'upi_id',
  'photo_uri',
  'salary_paise',
  'salary_type',
  'weekly_offs',
  'paid_leaves_per_month',
  'start_date',
  'end_date',
  'unit_label',
  'default_quantity',
  'is_active',
  'archived_at',
]);

/* ---------- settings ---------- */

export function getSetting(key: string): string | null {
  const row = conn().getFirstSync<{ value: string }>(
    'SELECT value FROM app_setting WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  conn().runSync(
    `INSERT INTO app_setting (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

export function updateHelper(id: number, patch: Partial<Helper>): void {
  const entries = Object.entries(patch).filter(([k]) => HELPER_COLUMNS.has(k));
  if (entries.length === 0) return;
  const sets = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => (v ?? null) as SQLite.SQLiteBindValue);
  conn().runSync(`UPDATE helper SET ${sets} WHERE id = ?`, ...values, id);
}

/** Employment genuinely ended: recorded, and it closes the salary window. */
export function archiveHelper(id: number): void {
  conn().runSync(
    'UPDATE helper SET is_active = 0, archived_at = ? WHERE id = ?',
    todayKey(),
    id,
  );
}

/**
 * Hidden by the free-tier cap only. Deliberately leaves archived_at null so
 * payroll still treats them as employed and nothing is lost on downgrade.
 */
export function deactivateHelper(id: number): void {
  conn().runSync('UPDATE helper SET is_active = 0 WHERE id = ?', id);
}

export function reactivateHelper(id: number): void {
  conn().runSync(
    'UPDATE helper SET is_active = 1, archived_at = NULL WHERE id = ?',
    id,
  );
}

/* ---------- attendance ---------- */

export function getAttendanceForPeriod(
  helperId: number,
  period: string,
): Attendance[] {
  const { start, end } = periodBounds(period);
  return conn().getAllSync<Attendance>(
    'SELECT * FROM attendance WHERE helper_id = ? AND date BETWEEN ? AND ? ORDER BY date',
    helperId,
    start,
    end,
  );
}

/** Every attendance row ever, for a worker — see computeWorkerBalance(). */
export function getAllAttendance(helperId: number): Attendance[] {
  return conn().getAllSync<Attendance>(
    'SELECT * FROM attendance WHERE helper_id = ? ORDER BY date',
    helperId,
  );
}

export function getAttendanceForDate(dateKey: string): Attendance[] {
  return conn().getAllSync<Attendance>(
    'SELECT * FROM attendance WHERE date = ?',
    dateKey,
  );
}

export function markAttendance(
  helperId: number,
  dateKey: string,
  status: AttendanceStatus,
  opts: { hours?: number | null; note?: string | null; quantity?: number | null } = {},
): void {
  conn().runSync(
    `INSERT INTO attendance
       (helper_id, date, status, hours_worked, quantity, note, marked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(helper_id, date) DO UPDATE SET
       status = excluded.status,
       hours_worked = excluded.hours_worked,
       quantity = excluded.quantity,
       note = excluded.note,
       marked_at = excluded.marked_at`,
    helperId,
    dateKey,
    status,
    opts.hours ?? null,
    opts.quantity ?? null,
    opts.note ?? null,
    new Date().toISOString(),
  );
}

export function clearAttendance(helperId: number, dateKey: string): void {
  conn().runSync(
    'DELETE FROM attendance WHERE helper_id = ? AND date = ?',
    helperId,
    dateKey,
  );
}

/** Bulk-fill the days that never got marked. */
export function markMany(
  helperId: number,
  dateKeys: string[],
  status: AttendanceStatus,
): void {
  conn().withTransactionSync(() => {
    for (const key of dateKeys) markAttendance(helperId, key, status);
  });
}

/* ---------- ledger ---------- */

export function getLedgerForPeriod(
  helperId: number,
  period: string,
): LedgerEntry[] {
  const { start, end } = periodBounds(period);
  return conn().getAllSync<LedgerEntry>(
    'SELECT * FROM ledger_entry WHERE helper_id = ? AND date BETWEEN ? AND ? ORDER BY date',
    helperId,
    start,
    end,
  );
}

export function addLedgerEntry(input: {
  helper_id: number;
  date?: string;
  type: LedgerType;
  amount_paise: number;
  note?: string | null;
}): number {
  const result = conn().runSync(
    `INSERT INTO ledger_entry (helper_id, date, type, amount_paise, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.helper_id,
    input.date ?? todayKey(),
    input.type,
    input.amount_paise,
    input.note ?? null,
    new Date().toISOString(),
  );
  return result.lastInsertRowId;
}

export function deleteLedgerEntry(id: number): void {
  conn().runSync('DELETE FROM ledger_entry WHERE id = ?', id);
}

/* ---------- payments ---------- */

export function getPayments(helperId: number, period: string): Payment[] {
  return conn().getAllSync<Payment>(
    'SELECT * FROM payment WHERE helper_id = ? AND period = ? ORDER BY paid_on',
    helperId,
    period,
  );
}

/** Every payment ever recorded for a worker, for the running balance-due. */
export function getAllPayments(helperId: number): Payment[] {
  return conn().getAllSync<Payment>(
    'SELECT * FROM payment WHERE helper_id = ? ORDER BY paid_on',
    helperId,
  );
}

/** Every ledger entry ever recorded, for the worker's payment history. */
export function getAllLedgerEntries(helperId: number): LedgerEntry[] {
  return conn().getAllSync<LedgerEntry>(
    'SELECT * FROM ledger_entry WHERE helper_id = ? ORDER BY date DESC, id DESC',
    helperId,
  );
}

export function recordPayment(input: {
  helper_id: number;
  period: string;
  amount_paise: number;
  method?: Payment['method'];
  note?: string | null;
}): number {
  const result = conn().runSync(
    `INSERT INTO payment (helper_id, period, paid_on, amount_paise, method, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.helper_id,
    input.period,
    todayKey(),
    input.amount_paise,
    input.method ?? 'cash',
    input.note ?? null,
  );
  return result.lastInsertRowId;
}

/**
 * There is no edit for a ledger entry or payment — delete and re-add covers
 * the same ground with far less UI, and a wrong-amount entry is rare enough
 * that a confirm-then-redo is not real friction.
 */
export function deletePayment(id: number): void {
  conn().runSync('DELETE FROM payment WHERE id = ?', id);
}

/* ---------- snapshots ---------- */

/**
 * Freezes the computed payout for a period so a payslip already shared on
 * WhatsApp is not rewritten by a later edit to that month's attendance.
 */
export function saveSnapshot(
  helperId: number,
  period: string,
  computed: unknown,
): void {
  conn().runSync(
    `INSERT INTO payroll_snapshot (helper_id, period, computed_json, settled_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(helper_id, period) DO UPDATE SET
       computed_json = excluded.computed_json,
       settled_at = excluded.settled_at`,
    helperId,
    period,
    JSON.stringify(computed),
    new Date().toISOString(),
  );
}

export function getSnapshot<T>(helperId: number, period: string): T | null {
  const row = conn().getFirstSync<{ computed_json: string }>(
    'SELECT computed_json FROM payroll_snapshot WHERE helper_id = ? AND period = ?',
    helperId,
    period,
  );
  return row ? (JSON.parse(row.computed_json) as T) : null;
}

/* ---------- backup / restore ---------- */

interface SnapshotRow {
  id: number;
  helper_id: number;
  period: string;
  computed_json: string;
  settled_at: string;
}

interface SettingRow {
  key: string;
  value: string;
}

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  helpers: Helper[];
  attendance: Attendance[];
  ledgerEntries: LedgerEntry[];
  payments: Payment[];
  snapshots: SnapshotRow[];
  settings: SettingRow[];
}

/** Every row in every table, as plain data — the whole app, in one object. */
export function exportAllData(): BackupPayload {
  const c = conn();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    helpers: c.getAllSync<Helper>('SELECT * FROM helper'),
    attendance: c.getAllSync<Attendance>('SELECT * FROM attendance'),
    ledgerEntries: c.getAllSync<LedgerEntry>('SELECT * FROM ledger_entry'),
    payments: c.getAllSync<Payment>('SELECT * FROM payment'),
    snapshots: c.getAllSync<SnapshotRow>('SELECT * FROM payroll_snapshot'),
    settings: c.getAllSync<SettingRow>('SELECT * FROM app_setting'),
  };
}

/**
 * Wipes every table and reinserts the backup with its original ids intact,
 * so foreign keys (attendance.helper_id, etc.) line up without remapping.
 * This is a full replace, not a merge — the confirmation lives in the UI
 * layer, since this function has no way to ask.
 */
export function importAllData(payload: BackupPayload): void {
  const c = conn();
  c.withTransactionSync(() => {
    c.execSync(`
      DELETE FROM payroll_snapshot;
      DELETE FROM payment;
      DELETE FROM ledger_entry;
      DELETE FROM attendance;
      DELETE FROM helper;
      DELETE FROM app_setting;
    `);

    for (const h of payload.helpers) {
      c.runSync(
        `INSERT INTO helper
           (id, name, role, phone, upi_id, photo_uri, salary_paise, salary_type,
            weekly_offs, paid_leaves_per_month, start_date, end_date,
            unit_label, default_quantity, is_active, created_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        h.id, h.name, h.role, h.phone, h.upi_id ?? null, h.photo_uri, h.salary_paise,
        h.salary_type, h.weekly_offs, h.paid_leaves_per_month, h.start_date,
        h.end_date, h.unit_label, h.default_quantity, h.is_active,
        h.created_at, h.archived_at,
      );
    }
    for (const a of payload.attendance) {
      c.runSync(
        `INSERT INTO attendance
           (id, helper_id, date, status, hours_worked, quantity, note, marked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        a.id, a.helper_id, a.date, a.status, a.hours_worked, a.quantity,
        a.note, a.marked_at,
      );
    }
    for (const l of payload.ledgerEntries) {
      c.runSync(
        `INSERT INTO ledger_entry
           (id, helper_id, date, type, amount_paise, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        l.id, l.helper_id, l.date, l.type, l.amount_paise, l.note, l.created_at,
      );
    }
    for (const p of payload.payments) {
      c.runSync(
        `INSERT INTO payment
           (id, helper_id, period, paid_on, amount_paise, method, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        p.id, p.helper_id, p.period, p.paid_on, p.amount_paise, p.method, p.note,
      );
    }
    for (const s of payload.snapshots) {
      c.runSync(
        `INSERT INTO payroll_snapshot
           (id, helper_id, period, computed_json, settled_at)
         VALUES (?, ?, ?, ?, ?)`,
        s.id, s.helper_id, s.period, s.computed_json, s.settled_at,
      );
    }
    for (const st of payload.settings) {
      c.runSync(
        'INSERT INTO app_setting (key, value) VALUES (?, ?)',
        st.key,
        st.value,
      );
    }
  });
}
