import { Helper, STATUS_LABEL } from './types';
import { PayrollBreakdown } from './salary';
import { formatINR } from './money';
import { daysInPeriod, formatDateKey, formatPeriod, todayKey } from './dates';

/**
 * Pure HTML generation, deliberately free of react-native imports so the
 * payslip can be rendered and eyeballed in plain node before it ever reaches
 * a device.
 */
export function spanLabel(payroll: PayrollBreakdown): string {
  if (!payroll.isPartialMonth) return formatPeriod(payroll.period);
  return `${formatDateKey(payroll.windowStart)} – ${formatDateKey(payroll.windowEnd)}`;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** Brand colours, matching the app's teal so the slip looks like the app. */
const BRAND = {
  ink: '#0B1220',
  teal: '#0F766E',
  tealDark: '#0B5D57',
  mist: '#F4F7F8',
  line: '#E3E9EC',
  grey: '#6B7A87',
  green: '#12B76A',
  amber: '#F79009',
  red: '#F04438',
};

const STATUS_TINT: Record<string, string> = {
  present: BRAND.green,
  half_day: BRAND.amber,
  absent: BRAND.red,
  paid_leave: '#6172F3',
  week_off: '#98A2B3',
  holiday: '#98A2B3',
};

/**
 * The whole slip is inline HTML and CSS — no fetched template, no webfont,
 * no remote image. A downloaded template would mean a network call, a licence
 * to honour, and a slip that fails to render the first time someone opens the
 * app offline, which is most of the time for this app.
 */
export function buildPayslipHtml(
  helper: Helper,
  payroll: PayrollBreakdown,
): string {
  const isPerUnit = helper.salary_type === 'per_unit';
  const unit = helper.unit_label ?? 'unit';

  const initials = helper.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const chips = Object.entries(payroll.counts)
    .map(([status, count]) => {
      const label = STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status;
      const tint = STATUS_TINT[status] ?? BRAND.grey;
      return `
        <div class="chip">
          <span class="chip-dot" style="background:${tint}"></span>
          <span class="chip-n">${count}</span>
          <span class="chip-l">${escapeHtml(label)}</span>
        </div>`;
    })
    .join('');

  const unmarkedChip =
    payroll.unmarkedDays > 0
      ? `<div class="chip">
           <span class="chip-dot" style="background:${BRAND.line}"></span>
           <span class="chip-n">${payroll.unmarkedDays}</span>
           <span class="chip-l">Not marked</span>
         </div>`
      : '';

  const row = (label: string, value: string, kind = '') => `
    <tr class="${kind}">
      <td>${escapeHtml(label)}</td>
      <td class="num">${escapeHtml(value)}</td>
    </tr>`;

  const basis = isPerUnit
    ? row(`Rate per ${unit}`, formatINR(payroll.dayRatePaise)) +
      row('Total delivered', `${payroll.totalQuantity} ${unit}`)
    : row('Day rate', formatINR(payroll.dayRatePaise)) +
      row('Payable days', String(payroll.payableDays));

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  /* Print is A4; on screen we pin the same width so a browser preview of this
     file shows exactly what the PDF will look like. */
  @media screen {
    body { width: 794px; margin: 0 auto; }
  }
  body {
    margin: 0;
    /* Roboto and Noto both carry U+20B9; the fallbacks keep the rupee sign
       from rendering as a blank box on older Android WebViews. */
    font-family: Roboto, 'Noto Sans', 'Segoe UI', Arial, sans-serif;
    color: ${BRAND.ink};
    font-size: 13px;
    background: #fff;
  }
  .band {
    background: linear-gradient(135deg, ${BRAND.teal}, ${BRAND.tealDark});
    color: #fff;
    padding: 30px 36px 26px;
  }
  /* Wrapping rather than overlapping: "GharKhata" is one unbreakable word, so
     without wrap the label rides on top of it on any narrow render. */
  .band-top {
    display: flex; align-items: center; justify-content: space-between;
    gap: 4px 16px; flex-wrap: wrap;
  }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .mark {
    flex: 0 0 26px; width: 26px; height: 26px; border-radius: 7px;
    background: rgba(255,255,255,.22);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; line-height: 1;
  }
  .brand-name { font-size: 15px; font-weight: 700; letter-spacing: .02em; }
  .doc {
    flex: 0 0 auto; font-size: 10px; letter-spacing: .16em;
    text-transform: uppercase; opacity: .8; white-space: nowrap;
  }
  .hero { margin-top: 22px; }
  .hero-label {
    font-size: 10px; letter-spacing: .16em;
    text-transform: uppercase; opacity: .8;
  }
  .hero-amount { font-size: 34px; font-weight: 700; margin-top: 2px; }
  .hero-span { font-size: 12px; opacity: .85; margin-top: 4px; }

  .who {
    display: flex; align-items: center; gap: 14px;
    padding: 22px 36px; border-bottom: 1px solid ${BRAND.line};
  }
  .avatar {
    flex: 0 0 44px; width: 44px; height: 44px; border-radius: 50%;
    background: ${BRAND.mist}; color: ${BRAND.teal};
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 16px;
  }
  .who-name { font-size: 17px; font-weight: 700; }
  .who-role { font-size: 12px; color: ${BRAND.grey}; margin-top: 1px; }

  .section { padding: 22px 36px 0; }
  h2 {
    font-size: 10px; letter-spacing: .16em; text-transform: uppercase;
    color: ${BRAND.grey}; margin: 0 0 12px;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    display: flex; align-items: center; gap: 6px;
    border: 1px solid ${BRAND.line}; border-radius: 999px;
    padding: 5px 12px 5px 9px; background: #fff;
  }
  .chip-dot { width: 8px; height: 8px; border-radius: 50%; }
  .chip-n { font-weight: 700; }
  .chip-l { color: ${BRAND.grey}; font-size: 12px; }

  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  td { padding: 9px 0; border-bottom: 1px solid ${BRAND.line}; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.add td.num { color: ${BRAND.green}; }
  tr.sub td.num { color: ${BRAND.red}; }
  tr.total td {
    border-bottom: none; border-top: 2px solid ${BRAND.ink};
    padding-top: 14px; font-size: 17px; font-weight: 700;
  }

  .foot {
    margin-top: 26px; padding: 14px 36px;
    background: ${BRAND.mist}; color: ${BRAND.grey}; font-size: 10px;
    display: flex; justify-content: space-between;
  }
</style>
</head>
<body>
  <div class="band">
    <div class="band-top">
      <div class="brand">
        <div class="mark">₹</div>
        <div class="brand-name">GharKhata</div>
      </div>
      <span class="doc">Salary Slip</span>
    </div>
    <div class="hero">
      <div class="hero-label">Net payable</div>
      <div class="hero-amount">${escapeHtml(formatINR(payroll.netPayablePaise))}</div>
      <div class="hero-span">${escapeHtml(spanLabel(payroll))}${
        payroll.isPartialMonth
          ? ` &middot; ${payroll.engagedDays} of ${daysInPeriod(payroll.period)} days`
          : ''
      }</div>
    </div>
  </div>

  <div class="who">
    <div class="avatar">${escapeHtml(initials || '?')}</div>
    <div>
      <div class="who-name">${escapeHtml(helper.name)}</div>
      <div class="who-role">${escapeHtml(helper.role || 'Worker')}${
        helper.phone ? ` &middot; ${escapeHtml(helper.phone)}` : ''
      }</div>
    </div>
  </div>

  <div class="section">
    <h2>Attendance</h2>
    <div class="chips">${chips}${unmarkedChip}</div>
  </div>

  <div class="section">
    <h2>Calculation</h2>
    <table>
      ${basis}
      ${row('Earned', formatINR(payroll.earnedPaise))}
      ${payroll.bonusesPaise > 0 ? row('Bonus', `+${formatINR(payroll.bonusesPaise)}`, 'add') : ''}
      ${payroll.advancesPaise !== 0 ? row('Advance taken', `-${formatINR(payroll.advancesPaise)}`, 'sub') : ''}
      ${payroll.finesPaise > 0 ? row('Deduction', `-${formatINR(payroll.finesPaise)}`, 'sub') : ''}
      ${row('Net payable', formatINR(payroll.netPayablePaise), 'total')}
    </table>
  </div>


  <div class="foot">
    <span>Generated ${escapeHtml(formatDateKey(todayKey()))}</span>
    <span>GharKhata</span>
  </div>
</body>
</html>`;
}

