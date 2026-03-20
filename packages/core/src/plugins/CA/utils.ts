/** English month abbreviations → month number (01-12). Keys are lowercase. */
export const EN_MONTHS: Record<string, string> = {
  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
  'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
  'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
};

/** Parse CAD currency format: "$1,581.00" → 1581.00, "-$19.44" → -19.44 */
export function parseCADAmount(raw: string): number {
  return parseFloat(raw.replace(/[$,]/g, ''));
}
