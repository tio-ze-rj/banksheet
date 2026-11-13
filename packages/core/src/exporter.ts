import ExcelJS from 'exceljs';
import type { Transaction } from './types';

const BASE_COLUMNS = ['date', 'description', 'amount', 'currency', 'type'] as const;

/** Optional columns: only exported when at least one transaction has a value. */
const OPTIONAL_COLUMNS = [
  'account',
  'counterAccount',
  'payee',
  'category',
  'externalId',
  'bookingDate',
  'exchangeRate',
  'notes',
] as const;

const EXCEL_HEADERS: Record<string, { header: string; width: number }> = {
  date: { header: 'Date', width: 12 },
  description: { header: 'Description', width: 40 },
  amount: { header: 'Amount', width: 12 },
  currency: { header: 'Currency', width: 8 },
  type: { header: 'Type', width: 8 },
  account: { header: 'Account', width: 28 },
  counterAccount: { header: 'Counter account', width: 28 },
  payee: { header: 'Payee', width: 28 },
  category: { header: 'Category', width: 16 },
  externalId: { header: 'External ID', width: 36 },
  bookingDate: { header: 'Booking date', width: 12 },
  exchangeRate: { header: 'Exchange rate', width: 12 },
  notes: { header: 'Notes', width: 50 },
};

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** CSV header for a column: multi-word field names in snake_case (externalId -> external_id). */
function csvHeader(col: string): string {
  return col.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
}

function activeColumns(transactions: Transaction[]): string[] {
  const optional = OPTIONAL_COLUMNS.filter(col =>
    transactions.some(t => t[col] !== undefined && t[col] !== ''),
  );
  return [...BASE_COLUMNS, ...optional];
}

function cell(t: Transaction, col: string): string {
  const v = (t as unknown as Record<string, unknown>)[col];
  return v === undefined || v === null ? '' : String(v);
}

export function exportCSV(transactions: Transaction[]): string {
  const columns = activeColumns(transactions);
  const header = columns.map(csvHeader).join(',');
  const rows = transactions.map(t => columns.map(col => escapeCSV(cell(t, col))).join(','));
  return [header, ...rows].join('\n');
}

export function exportJSON(transactions: Transaction[]): string {
  return JSON.stringify(transactions, null, 2);
}

export async function exportExcel(transactions: Transaction[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Transactions');

  const columns = activeColumns(transactions);
  sheet.columns = columns.map(key => ({ key, ...EXCEL_HEADERS[key] }));

  for (const t of transactions) {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      const v = (t as unknown as Record<string, unknown>)[col];
      row[col] = v === undefined ? '' : v;
    }
    sheet.addRow(row);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
