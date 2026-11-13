/** Parse a Mexican-peso amount like "1,234.56" (comma thousands, dot decimal) into a number. */
export function parseMXAmount(raw: string): number {
  const cleaned = raw.replace(/[$\s,]/g, '');
  const value = parseFloat(cleaned);
  return Number.isNaN(value) ? 0 : value;
}

/** Round to 2 decimals, avoiding float noise from balance arithmetic. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Amount in integer cents (avoids float noise in IDs). */
export function toCents(n: number): number {
  return Math.round(n * 100);
}

/** Compact ISO date for IDs: 2026-09-02 -> 20260902. */
export function compactDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

/**
 * Returns a function that numbers repeated keys (1, 2, 3...) so lines that are
 * otherwise identical still get distinct IDs.
 */
export function occurrenceCounter(): (key: string) => number {
  const seen = new Map<string, number>();
  return (key: string) => {
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n;
  };
}
