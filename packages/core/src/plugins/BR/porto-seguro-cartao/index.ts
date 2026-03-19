import type { BankParser, Transaction } from '../../../types';
import { parseBRAmount } from '../utils';

// Hoisted regexes — compiled once at module load
const DUE_DATE_RE = /vence\s+em\s*\n\s*(\d{2})\/(\d{2})\/(\d{4})/i;
const TXN_HEADER_RE = /^Data\s+Estabelecimento\s+Valor\s+em\s+R\$/i;
const TXN_LINE_RE = /^(\d{2})\/(\d{2})\s+(.+?)\s+(-?[\d.,]+)\s*$/;
const TOTAL_LINE_RE = /^Lan[cç]amentos\s+no\s+cart[aã]o/i;
const PAGE_BREAK_RE = /^--- PAGE BREAK ---/;

export const portoSeguroCartaoParser: BankParser = {
  name: 'Porto Seguro Cartão',
  country: 'BR',

  detect(text: string): boolean {
    return (
      /Porto\s*Bank/i.test(text) ||
      /PORTOSEG\s*S\/?A/i.test(text) ||
      /cartaoportoseguro/i.test(text) ||
      /CNPJ\s*04\.862\.600/i.test(text)
    );
  },

  parse(text: string): Transaction[] {
    const lines = text.split('\n').map(l => l.trim());

    // Extract year from due date: "vence em\n01/03/2026"
    const dueMatch = text.match(DUE_DATE_RE);
    const dueMonth = dueMatch ? parseInt(dueMatch[2], 10) : new Date().getMonth() + 1;
    const dueYear = dueMatch ? parseInt(dueMatch[3], 10) : new Date().getFullYear();

    // Find transaction section start
    const startIdx = lines.findIndex(l => TXN_HEADER_RE.test(l));
    if (startIdx === -1) return [];

    const transactions: Transaction[] = [];

    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];

      if (!line || PAGE_BREAK_RE.test(line)) continue;
      if (TOTAL_LINE_RE.test(line)) break;

      const match = line.match(TXN_LINE_RE);
      if (!match) continue;

      const [, day, month, rawDesc, rawAmount] = match;
      const txnMonth = parseInt(month, 10);

      // Billing cycles span ~30 days, so txn month > due month means previous year
      // (e.g. due date March, txn in July = installment from previous year)
      const txnYear = txnMonth > dueMonth ? dueYear - 1 : dueYear;
      const date = `${txnYear}-${month}-${day}`;

      const isCredit = rawAmount.startsWith('-');
      const amount = parseBRAmount(rawAmount.replace(/^-/, ''));
      const description = rawDesc.replace(/\s+/g, ' ').trim();

      transactions.push({
        date,
        description,
        amount: isCredit ? amount : -amount,
        currency: 'BRL',
        type: isCredit ? 'credit' : 'debit',
        raw: line,
      });
    }

    return transactions;
  },
};
