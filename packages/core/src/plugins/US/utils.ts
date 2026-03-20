/** English month abbreviations → month number (01-12). Keys are lowercase. */
export const EN_MONTHS: Record<string, string> = {
  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
  'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
  'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
};

/** Parse USD currency format: "1,234.56" → 1234.56, "-1,234.56" → -1234.56, "$50.00" → 50.00 */
export function parseUSDAmount(raw: string): number {
  return parseFloat(raw.replace(/[$,]/g, ''));
}
