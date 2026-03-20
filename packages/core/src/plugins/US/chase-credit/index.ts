import type { BankParser, Transaction } from '../../../types';
import { parseUSDAmount } from '../utils';

// Hoisted regexes — compiled once at module load
const OPENING_CLOSING_RE = /opening\/closing\s+date\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+-\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i;
// Amount group is permissive — may need tightening once tested with real PDFs
const TXN_LINE_RE = /^(\d{1,2})\/(\d{1,2})\s+(\S.+?)\s+([-.\d,]+)$/;
const PAYMENTS_HEADER_RE = /^\s*payments\s+and\s+other\s+credits\s*$/i;
const PURCHASE_HEADER_RE = /^\s*purchases?\s*$/i;
const TOTALS_RE = /totals\s+year-to-date/i;
const PAGE_BREAK_RE = /^--- PAGE BREAK ---/;

type Section = 'header' | 'payment' | 'purchase' | 'end';

export const chaseCreditParser: BankParser = {
  name: 'Chase Credit',
  country: 'US',

  detect(text: string): boolean {
    return (
      (/opening\/closing\s+date/i.test(text) && /account\s+number:/i.test(text)) ||
      (/cardmember/i.test(text) && /payments\s+and\s+other\s+credits/i.test(text)) ||
      /JPMorgan\s+Chase/i.test(text)
    );
  },

  parse(text: string): Transaction[] {
    const lines = text.split('\n').map(l => l.trim());

    // Extract statement period from "opening/closing date MM/DD/YY - MM/DD/YY"
    const periodMatch = text.match(OPENING_CLOSING_RE);
    let endMonth = new Date().getMonth() + 1;
    let endYear = new Date().getFullYear();

    if (periodMatch) {
      endMonth = parseInt(periodMatch[4], 10);
      const rawYear = parseInt(periodMatch[6], 10);
      endYear = rawYear < 100 ? 2000 + rawYear : rawYear;
    }

    const transactions: Transaction[] = [];
    let section: Section = 'header';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line || PAGE_BREAK_RE.test(line)) continue;

      // State transitions
      if (PAYMENTS_HEADER_RE.test(line) && section === 'header') {
        section = 'payment';
        continue;
      }
      if (PURCHASE_HEADER_RE.test(line) && (section === 'header' || section === 'payment')) {
        section = 'purchase';
        continue;
      }
      if (TOTALS_RE.test(line)) {
        section = 'end';
        break;
      }

      // Only parse transaction lines in payment/purchase sections
      if (section !== 'payment' && section !== 'purchase') continue;

      const match = line.match(TXN_LINE_RE);
      if (!match) continue;

      const [, monthStr, dayStr, description, rawAmount] = match;
      const txnMonth = parseInt(monthStr, 10);
      const day = dayStr.padStart(2, '0');
      const month = monthStr.padStart(2, '0');

      // Year inference: if txn month > end month, it's from previous year
      const txnYear = txnMonth > endMonth ? endYear - 1 : endYear;
      const date = `${txnYear}-${month}-${day}`;

      const amount = parseUSDAmount(rawAmount);

      // Chase convention: positive = purchase, negative = payment/credit
      // Project convention: negative = expense, positive = income → invert for purchases
      const isCredit = amount < 0;
      const absAmount = Math.abs(amount);

      transactions.push({
        date,
        description: description.replace(/\s+/g, ' ').trim(),
        amount: isCredit ? absAmount : -absAmount,
        currency: 'USD',
        type: isCredit ? 'credit' : 'debit',
        raw: line,
      });
    }

    return transactions;
  },
};
