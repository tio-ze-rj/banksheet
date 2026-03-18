import { describe, it, expect } from 'vitest';
import { parseStatement } from '../parser';
import type { BankParser } from '../types';

const mockParser: BankParser = {
  name: 'Mock Bank',
  country: 'US',
  detect: (text) => text.includes('MOCK_BANK'),
  parse: () => [{
    date: '2026-01-01',
    description: 'Test',
    amount: -10,
    currency: 'USD',
    type: 'debit',
  }],
};

describe('parseStatement', () => {
  it('selects correct parser and returns transactions', () => {
    const result = parseStatement('MOCK_BANK\nsome data', [mockParser]);
    expect(result.bank).toBe('Mock Bank');
    expect(result.transactions).toHaveLength(1);
  });

  it('throws when no parser detects the text', () => {
    expect(() => parseStatement('unknown text', [mockParser]))
      .toThrow('No parser detected');
  });

  it('uses explicit parser when specified', () => {
    const result = parseStatement('any text', [mockParser], 'Mock Bank');
    expect(result.bank).toBe('Mock Bank');
  });

  it('throws when explicit parser name not found', () => {
    expect(() => parseStatement('any text', [mockParser], 'Unknown'))
      .toThrow('Parser not found');
  });

  it('calculates total from transactions', () => {
    const result = parseStatement('MOCK_BANK\ndata', [mockParser]);
    expect(result.total).toBe(-10);
  });

  it('defaults currency to USD when no transactions', () => {
    const emptyParser: BankParser = {
      name: 'Empty',
      country: 'US',
      detect: () => true,
      parse: () => [],
    };
    const result = parseStatement('text', [emptyParser]);
    expect(result.currency).toBe('USD');
  });
});
