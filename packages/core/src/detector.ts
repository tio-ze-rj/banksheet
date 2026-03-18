import type { BankParser } from './types';

/** Auto-detect which bank parser matches the statement text */
export function detectBank(
  text: string,
  parsers: BankParser[],
): BankParser | undefined {
  return parsers.find(p => p.detect(text));
}
