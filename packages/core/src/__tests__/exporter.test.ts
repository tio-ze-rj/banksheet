import { describe, it, expect } from 'vitest';
import { exportCSV, exportJSON, exportExcel } from '../exporter';
import type { Transaction } from '../types';

const transactions: Transaction[] = [
  { date: '2026-01-03', description: 'SUPERMERCADO', amount: -150, currency: 'BRL', type: 'debit' },
  { date: '2026-01-04', description: 'REFUND', amount: 19.90, currency: 'BRL', type: 'credit' },
];

describe('exportCSV', () => {
  it('returns CSV string with headers', () => {
    const csv = exportCSV(transactions);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('date,description,amount,currency,type');
    expect(lines[1]).toContain('2026-01-03');
    expect(lines[1]).toContain('SUPERMERCADO');
    expect(lines[1]).toContain('-150');
  });

  it('escapes descriptions with commas', () => {
    const tx: Transaction[] = [{
      date: '2026-01-01', description: 'FOO, BAR', amount: -10, currency: 'BRL', type: 'debit',
    }];
    const csv = exportCSV(tx);
    expect(csv).toContain('"FOO, BAR"');
  });

  it('escapes descriptions with quotes', () => {
    const tx: Transaction[] = [{
      date: '2026-01-01', description: 'FOO "BAR"', amount: -10, currency: 'BRL', type: 'debit',
    }];
    const csv = exportCSV(tx);
    expect(csv).toContain('"FOO ""BAR"""');
  });
});

describe('exportJSON', () => {
  it('returns valid JSON array', () => {
    const json = exportJSON(transactions);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].date).toBe('2026-01-03');
  });
});

describe('exportExcel', () => {
  it('returns a Buffer', async () => {
    const buffer = await exportExcel(transactions);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
