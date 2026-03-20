import type { BankParser, Transaction } from '../../../types';
import { parseCADAmount, EN_MONTHS } from '../utils';

// Hoisted regexes — compiled once at module load
const STATEMENT_DATE_RE = /Statement\s+date:\s+([A-Za-z]+)\.?\s+(\d{1,2}),\s+(\d{4})/i;
const STATEMENT_PERIOD_RE = /Statement\s+period:.*?-\s+([A-Za-z]+)\.?\s+(\d{1,2}),\s+(\d{4})/i;
const TXN_LINE_RE = /^(\d{2})\/(\d{2})\s+\d{2}\/\d{2}\s+(.+?)\s+(-?\$[\d,]+\.\d{2})\s*$/;
const TXN_FOREIGN_RE = /^(\d{2})\/(\d{2})\s+\d{2}\/\d{2}\s+(.+?)\s+([A-Z]{3})\s*$/;
const FOREIGN_AMOUNT_RE = /(-?\$[\d,]+\.\d{2})\s*$/;
const TOTAL_LINE_RE = /^Total\s+(payment|purchase)\s+activity/i;
const SKIP_RE = /^(XXXX|Page\s+\d|Statement\s+details|Presidents?\s+Choice|PC.\s+World|Transaction|date|dd\/mm|Posting|Account\s+activity|Amount|MISS\s|MR\s|MRS\s)/i;
const PAGE_BREAK_RE = /^--- PAGE BREAK ---/;
const INTEREST_RATES_RE = /^Interest\s+rates$/i;

export const pcFinancialMastercardParser: BankParser = {
  name: 'PC Financial Mastercard',
  country: 'CA',

  detect(text: string): boolean {
    return (
      /President[''\u2019]?s?\s*Choice\s*(Financial|Bank)/i.test(text) ||
      /PC\s*Financial/i.test(text) ||
      /pcfinancial\.ca/i.test(text) ||
      /PC.*World\s*Mastercard/i.test(text)
    );
  },

  parse(text: string): Transaction[] {
    const lines = text.split('\n').map(l => l.trim());

    // Extract statement year and month
    const dateMatch = text.match(STATEMENT_DATE_RE) || text.match(STATEMENT_PERIOD_RE);
    let stmtMonth = new Date().getMonth() + 1;
    let stmtYear = new Date().getFullYear();

    if (dateMatch) {
      const monthAbbr = dateMatch[1].substring(0, 3).toLowerCase();
      stmtMonth = parseInt(EN_MONTHS[monthAbbr] || '01', 10);
      stmtYear = parseInt(dateMatch[3], 10);
    }

    // Find transaction section start
    const startIdx = lines.findIndex(l => /Account\s+activity/i.test(l));
    if (startIdx === -1) return [];

    const transactions: Transaction[] = [];

    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];

      if (!line || PAGE_BREAK_RE.test(line)) continue;
      if (INTEREST_RATES_RE.test(line)) break;
      if (TOTAL_LINE_RE.test(line)) continue;
      if (SKIP_RE.test(line)) continue;

      // Regular transaction: DD/MM DD/MM DESCRIPTION -?$AMOUNT
      const match = line.match(TXN_LINE_RE);
      if (match) {
        const [, day, month, rawDesc, rawAmount] = match;
        transactions.push(buildTransaction(day, month, rawDesc, rawAmount, stmtMonth, stmtYear, line));
        continue;
      }

      // Foreign currency transaction: DD/MM DD/MM DESCRIPTION CURRENCY_CODE
      const foreignMatch = line.match(TXN_FOREIGN_RE);
      if (foreignMatch) {
        const [, day, month, rawDesc] = foreignMatch;
        // Look ahead for the CAD amount on the next line
        const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
        const amountMatch = nextLine.match(FOREIGN_AMOUNT_RE);
        if (amountMatch) {
          const rawAmount = amountMatch[1];
          transactions.push(buildTransaction(day, month, rawDesc, rawAmount, stmtMonth, stmtYear, line + '\n' + nextLine));
          i++; // skip the amount line
        }
        continue;
      }
    }

    return transactions;
  },
};

function buildTransaction(
  day: string,
  month: string,
  rawDesc: string,
  rawAmount: string,
  stmtMonth: number,
  stmtYear: number,
  raw: string,
): Transaction {
  const txnMonth = parseInt(month, 10);
  // If transaction month > statement month, it's from previous year
  const txnYear = txnMonth > stmtMonth ? stmtYear - 1 : stmtYear;
  const date = `${txnYear}-${month}-${day}`;

  const parsed = parseCADAmount(rawAmount);
  const isCredit = parsed < 0;
  const absAmount = Math.abs(parsed);
  const description = rawDesc.replace(/\s+/g, ' ').trim();

  // Statement convention: positive = purchase (expense), negative = payment/credit (income)
  // Project convention: negative = expense, positive = income → invert sign for purchases
  return {
    date,
    description,
    amount: isCredit ? absAmount : -absAmount,
    currency: 'CAD',
    type: isCredit ? 'credit' : 'debit',
    raw,
  };
}
