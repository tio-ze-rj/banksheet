import { describe, it, expect } from 'vitest';
import { parseStatement, exportCSV, exportJSON, exportExcel } from '../../index';
import { plugins } from '../../plugins/index';

const ITAU_TEXT = `
ITAUUNIBANCOHOLDINGS.A.
05/01MERCADOLIVRE250,00
05/02SPOTIFY34,90
05/03DEVOLUCAOSPOTIFY- 34,90
05/10UBER*TRIP18,00
05/15AMAZONPRIME29,90
`;

describe('Core Pipeline Integration', () => {
  it('detect → parse → exportCSV full flow', () => {
    const result = parseStatement(ITAU_TEXT, plugins);
    expect(result.bank).toBe('Itaú Cartão');
    expect(result.transactions.length).toBe(5);

    const csv = exportCSV(result.transactions);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('date,description,amount,currency,type');
    expect(lines.length).toBe(6); // header + 5 rows
  });

  it('detect → parse → exportJSON full flow', () => {
    const result = parseStatement(ITAU_TEXT, plugins);
    const json = exportJSON(result.transactions);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(5);
    expect(parsed.every((t: any) => t.date && t.description && t.amount !== undefined)).toBe(true);
  });

  it('detect → parse → exportExcel full flow', async () => {
    const result = parseStatement(ITAU_TEXT, plugins);
    const buffer = await exportExcel(result.transactions);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('calculates correct total (expenses negative, refunds positive)', () => {
    const result = parseStatement(ITAU_TEXT, plugins);
    expect(result.total).toBeCloseTo(-297.90, 2);
  });

  it('throws for unknown bank text', () => {
    expect(() => parseStatement('random text\nno bank here', plugins))
      .toThrow('No parser detected');
  });

  it('handles text with no valid transaction lines', () => {
    const result = parseStatement('ITAUUNIBANCOHOLDINGS.A.\nno transactions here', plugins);
    expect(result.transactions).toHaveLength(0);
  });

  it('explicit bank override works', () => {
    const result = parseStatement(ITAU_TEXT, plugins, 'Itaú Cartão');
    expect(result.bank).toBe('Itaú Cartão');
  });

  it('explicit bank override throws for unknown bank', () => {
    expect(() => parseStatement(ITAU_TEXT, plugins, 'Unknown Bank'))
      .toThrow('Parser not found');
  });
});
