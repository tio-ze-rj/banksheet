import { describe, it, expect } from 'vitest';
import { compactDate, occurrenceCounter, parseMXAmount, round2, toCents } from '../utils';

describe('MX utils', () => {
  it('parseMXAmount handles thousands, currency sign and garbage', () => {
    expect(parseMXAmount('1,234.56')).toBe(1234.56);
    expect(parseMXAmount('$ 9,876.00')).toBe(9876);
    expect(parseMXAmount('abc')).toBe(0);
  });

  it('round2 removes float noise', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(41027 - 41015)).toBe(12);
  });

  it('toCents returns integer cents', () => {
    expect(toCents(1234.56)).toBe(123456);
    expect(toCents(-0.29)).toBe(-29);
  });

  it('compactDate strips dashes', () => {
    expect(compactDate('2026-03-05')).toBe('20260305');
  });

  it('occurrenceCounter numbers repeated keys independently', () => {
    const next = occurrenceCounter();
    expect([next('a'), next('b'), next('a'), next('a')]).toEqual([1, 1, 2, 3]);
  });
});
