import { Linking, Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Helper, STATUS_LABEL } from './types';
import { PayrollBreakdown } from './salary';
import { formatINR } from './money';
import { buildPayslipHtml, spanLabel } from './payslipHtml';

export { buildPayslipHtml };

/* ---------- WhatsApp / plain text ---------- */

export function buildPayslipText(
  helper: Helper,
  payroll: PayrollBreakdown,
): string {
  const lines: string[] = [];
  lines.push(`*Salary slip — ${helper.name}*`);
  lines.push(spanLabel(payroll));
  lines.push('');

  for (const [status, count] of Object.entries(payroll.counts)) {
    const label = STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status;
    lines.push(`${label}: ${count}`);
  }
  if (payroll.unmarkedDays > 0) {
    lines.push(`Not marked: ${payroll.unmarkedDays} (not paid)`);
  }

  lines.push('');
  if (helper.salary_type === 'per_unit') {
    const unit = helper.unit_label ?? 'unit';
    lines.push(`Rate: ${formatINR(payroll.dayRatePaise)} per ${unit}`);
    lines.push(`Total: ${payroll.totalQuantity} ${unit}`);
  } else {
    lines.push(`Day rate: ${formatINR(payroll.dayRatePaise)}`);
    lines.push(`Payable days: ${payroll.payableDays}`);
  }
  lines.push(`Earned: ${formatINR(payroll.earnedPaise)}`);

  if (payroll.bonusesPaise > 0) {
    lines.push(`Bonus: +${formatINR(payroll.bonusesPaise)}`);
  }
  if (payroll.advancesPaise !== 0) {
    lines.push(`Advance taken: -${formatINR(payroll.advancesPaise)}`);
  }
  if (payroll.finesPaise > 0) {
    lines.push(`Deduction: -${formatINR(payroll.finesPaise)}`);
  }

  lines.push('');
  lines.push(`*Net payable: ${formatINR(payroll.netPayablePaise)}*`);
  return lines.join('\n');
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
  const { uri } = await Print.printToFileAsync({
    html: buildPayslipHtml(helper, payroll),
    base64: false,
  });

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
