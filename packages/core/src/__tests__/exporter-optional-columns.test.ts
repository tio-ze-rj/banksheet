import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { exportCSV, exportExcel, exportJSON } from '../exporter';
import type { Transaction } from '../types';

const plain: Transaction = {
  date: '2026-01-02',
  description: 'Coffee',
  amount: -3.5,
  currency: 'USD',
  type: 'debit',
};

describe('exporter optional columns', () => {
  it('keeps the original five CSV columns when no optional field is set', () => {
    expect(exportCSV([plain])).toBe(
      ['date,description,amount,currency,type', '2026-01-02,Coffee,-3.5,USD,debit'].join('\n'),
    );
  });

  it('adds only the optional columns that at least one transaction uses', () => {
    const csv = exportCSV([
      plain,
      { ...plain, account: 'Main', externalId: 'abc:1' },
    ]);
    const [header, row1, row2] = csv.split('\n');
    expect(header).toBe('date,description,amount,currency,type,account,external_id');
    expect(row1).toBe('2026-01-02,Coffee,-3.5,USD,debit,,');
    expect(row2).toBe('2026-01-02,Coffee,-3.5,USD,debit,Main,abc:1');
  });

  it('exports every optional column in a stable order', () => {
    const csv = exportCSV([
      {
        ...plain,
        account: 'A',
        counterAccount: 'B',
        payee: 'P',
        category: 'C',
        externalId: 'id',
        bookingDate: '2026-01-03',
        exchangeRate: 18.4213,
        notes: 'n',
      },
    ]);
    expect(csv.split('\n')[0]).toBe(
      'date,description,amount,currency,type,account,counter_account,payee,category,external_id,booking_date,exchange_rate,notes',
    );
    expect(csv.split('\n')[1]).toBe('2026-01-02,Coffee,-3.5,USD,debit,A,B,P,C,id,2026-01-03,18.4213,n');
  });

  it('escapes commas and quotes in optional columns', () => {
    const csv = exportCSV([{ ...plain, account: 'Bank, "Main"' }]);
    expect(csv.split('\n')[1]).toContain('"Bank, ""Main"""');
  });

  it('includes optional fields in JSON', () => {
    const parsed = JSON.parse(exportJSON([{ ...plain, externalId: 'x' }]));
    expect(parsed[0].externalId).toBe('x');
  });

  it('adds optional columns to Excel only when used', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await exportExcel([{ ...plain, account: 'Main' }]));
    const headers = (wb.worksheets[0].getRow(1).values as unknown[]).slice(1);
    expect(headers).toEqual(['Date', 'Description', 'Amount', 'Currency', 'Type', 'Account']);

    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(await exportExcel([plain]));
    expect((wb2.worksheets[0].getRow(1).values as unknown[]).slice(1)).toHaveLength(5);
  });
});
