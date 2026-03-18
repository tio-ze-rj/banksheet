import ExcelJS from 'exceljs';
import type { Transaction } from './types';

const CSV_HEADERS = ['date', 'description', 'amount', 'currency', 'type'] as const;

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCSV(transactions: Transaction[]): string {
  const header = CSV_HEADERS.join(',');
  const rows = transactions.map(t =>
    [t.date, escapeCSV(t.description), String(t.amount), t.currency, t.type].join(',')
  );
  return [header, ...rows].join('\n');
}

export function exportJSON(transactions: Transaction[]): string {
  return JSON.stringify(transactions, null, 2);
}

export async function exportExcel(transactions: Transaction[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Transactions');

  sheet.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Currency', key: 'currency', width: 8 },
    { header: 'Type', key: 'type', width: 8 },
  ];

  for (const t of transactions) {
    sheet.addRow({
      date: t.date,
      description: t.description,
      amount: t.amount,
      currency: t.currency,
      type: t.type,
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
