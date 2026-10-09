import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Helper } from './types';
import { PayrollBreakdown } from './salary';
import { todayKey } from './dates';
import { buildPayslipHtml } from './payslipHtml';

export { buildPayslipHtml };

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
