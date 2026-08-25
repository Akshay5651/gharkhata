/**
 * All money is stored and computed as integer paise. Rupee floats drift
 * badly once you divide a monthly salary across days.
 */
export const toPaise = (rupees: number): number => Math.round(rupees * 100);

export const toRupees = (paise: number): number => paise / 100;

/** Indian grouping: 1,23,456 rather than 123,456. */
export function formatINR(paise: number, withSymbol = true): string {
  const negative = paise < 0;
  const rupees = Math.abs(paise) / 100;
  const fixed = rupees.toFixed(2);
  const [whole, decimals] = fixed.split('.');

  let grouped: string;
  if (whole.length <= 3) {
    grouped = whole;
  } else {
    const last3 = whole.slice(-3);
    const rest = whole.slice(0, -3);
    grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }

  const body = decimals === '00' ? grouped : `${grouped}.${decimals}`;
  return `${negative ? '-' : ''}${withSymbol ? '₹' : ''}${body}`;
}
