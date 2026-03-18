/** Portuguese month abbreviations → month number (01-12). Keys are lowercase. */
export const PT_MONTHS: Record<string, string> = {
  'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04',
  'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08',
  'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
};

/** Parse BR currency format: "1.523,81" → 1523.81 */
export function parseBRAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'));
}
