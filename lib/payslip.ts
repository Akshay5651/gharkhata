import { Linking, Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Helper, STATUS_LABEL } from './types';
import { PayrollBreakdown } from './salary';
import { formatINR } from './money';
import { todayKey } from './dates';
import { buildPayslipHtml, spanLabel } from './payslipHtml';

export { buildPayslipHtml };

/* ---------- WhatsApp / plain text ---------- */

const LABEL_WIDTH = 13;

/** Left-aligned label, right-aligned value — reads as a table once wrapped in a monospace block. */
function row(label: string, value: string): string {
  return `${label.padEnd(LABEL_WIDTH)}${value}`;
}

export function buildPayslipText(
  helper: Helper,
  payroll: PayrollBreakdown,
): string {
  const rows: string[] = [];

  for (const [status, count] of Object.entries(payroll.counts)) {
    const label = STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status;
    rows.push(row(label, String(count)));
  }
  if (payroll.unmarkedDays > 0) {
    rows.push(row('Not marked', `${payroll.unmarkedDays} (unpaid)`));
  }
  rows.push('');

  if (helper.salary_type === 'per_unit') {
    const unit = helper.unit_label ?? 'unit';
    rows.push(row('Rate', `${formatINR(payroll.dayRatePaise)}/${unit}`));
    rows.push(row('Total', `${payroll.totalQuantity} ${unit}`));
  } else if (helper.salary_type === 'hourly') {
    rows.push(row('Hourly rate', formatINR(payroll.dayRatePaise)));
    rows.push(row('Hours worked', String(payroll.payableDays)));
  } else {
    rows.push(row('Day rate', formatINR(payroll.dayRatePaise)));
    rows.push(row('Payable days', String(payroll.payableDays)));
  }
  rows.push(row('Earned', formatINR(payroll.earnedPaise)));

  if (payroll.bonusesPaise > 0) {
    rows.push(row('Bonus', `+${formatINR(payroll.bonusesPaise)}`));
  }
  if (payroll.advancesPaise !== 0) {
    rows.push(row('Advance', `-${formatINR(payroll.advancesPaise)}`));
  }
  if (payroll.finesPaise > 0) {
    rows.push(row('Deduction', `-${formatINR(payroll.finesPaise)}`));
  }
  rows.push('');
  rows.push(row('Net payable', formatINR(payroll.netPayablePaise)));

  // Wrapping the whole block in triple backticks doesn't render as a
  // monospace table in WhatsApp the way it does in Slack/Discord — WhatsApp
  // only recognizes single backticks around one inline span. Wrapping each
  // row individually is what actually switches that row to a fixed-width
  // font, which is what keeps the label/value columns aligned.
  const lines: string[] = [];
  lines.push(`*Salary slip — ${helper.name}*`);
  lines.push(spanLabel(payroll));
  lines.push('');
  for (const line of rows) {
    lines.push(line === '' ? '' : '`' + line + '`');
  }
  return lines.join('\n');
}

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
];

/** e.g. "Priya_SeptSlip_09-09-2026.pdf" — sanitized first name + month + generation date. */
function buildPayslipFileName(helper: Helper, payroll: PayrollBreakdown): string {
  const firstName =
    helper.name.trim().split(/\s+/)[0]?.replace(/[^a-zA-Z0-9]/g, '') || 'Worker';
  const [, periodMonth] = payroll.period.split('-').map(Number);
  const monthName = SHORT_MONTH_NAMES[periodMonth - 1];
  const [y, m, d] = todayKey().split('-');
  const dateStamp = `${d}-${m}-${y}`;
  return `${firstName}_${monthName}Slip_${dateStamp}.pdf`;
}

/**
 * Opens WhatsApp straight to the helper's chat when we have their number,
 * otherwise falls back to the system share sheet.
 */
export async function sharePayslipText(
  helper: Helper,
  payroll: PayrollBreakdown,
): Promise<void> {
  const message = buildPayslipText(helper, payroll);

  if (helper.phone) {
    const digits = helper.phone.replace(/\D/g, '');
    // Indian numbers are stored locally as 10 digits; wa.me needs the country code.
    const withCode = digits.length === 10 ? `91${digits}` : digits;
    const url = `whatsapp://send?phone=${withCode}&text=${encodeURIComponent(message)}`;
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return;
    }
  }

  await Share.share({ message });
}

/* ---------- PDF ---------- */

export async function sharePayslipPdf(
  helper: Helper,
  payroll: PayrollBreakdown,
): Promise<void> {
  const { uri: rawUri } = await Print.printToFileAsync({
    html: buildPayslipHtml(helper, payroll),
    base64: false,
  });

  // printToFileAsync always names the file a random UUID — copying it to a
  // fixed, meaningful name is what a recipient (or the "Save to device"
  // picker) actually sees, rather than "a3f9c21b-....pdf". Copying instead
  // of renaming in place, and deleting any stale file at that name first,
  // avoids a FileAlreadyExistsException when the same worker/month/day
  // combination is shared more than once (rename refuses to overwrite).
  const dest = new File(Paths.cache, buildPayslipFileName(helper, payroll));
  if (dest.exists) dest.delete();
  new File(rawUri).copy(dest);
  const uri = dest.uri;

  if (Platform.OS === 'android' && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Salary slip — ${helper.name}`,
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  await Sharing.shareAsync(uri);
}
