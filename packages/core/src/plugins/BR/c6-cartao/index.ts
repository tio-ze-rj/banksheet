import type { BankParser, Transaction } from '../../../types';
import { PT_MONTHS, parseBRAmount } from '../utils';

// Hoisted regexes — compiled once at module load
const TXN_LINE_RE = /^(\d{2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(.+?)\s+([\d.,]+)\s*$/i;
const CLOSING_DATE_RE = /fechamento\s+.*?(\d{2})\/(\d{2})\/(\d{2,4})/i;
const VENCIMENTO_YEAR_RE = /Vencimento:.*?(\d{2})\/(\d{2})\/(\d{4})/;
const PAGE_BREAK_RE = /^--- PAGE BREAK ---/;
const CARD_HEADER_RE = /^C6\s+Carbon\s+(Final|Virtual)/i;
const SUBTOTAL_RE = /Subtotal deste cart[aã]o/i;

export const c6CartaoParser: BankParser = {
  name: 'C6 Cartão',
  country: 'BR',

  detect(text: string): boolean {
    return (
      /C6\s*Bank/i.test(text) ||
      /C6\s*Carbon/i.test(text) ||
      /Banco\s*C6\s*S\.?A\.?/i.test(text) ||
      /31\.872\.495\/0001-72/i.test(text)
    );
  },

  parse(text: string): Transaction[] {
    const lines = text.split('\n').map(l => l.trim());

    // Extract closing date to determine statement year
    const closingMatch = text.match(CLOSING_DATE_RE);
    let closingMonth = 0;
    let statementYear = new Date().getFullYear();

    if (closingMatch) {
      closingMonth = parseInt(closingMatch[2], 10);
      const rawYear = closingMatch[3];
      statementYear = rawYear.length === 2 ? 2000 + parseInt(rawYear, 10) : parseInt(rawYear, 10);
    } else {
      // Fallback: derive closing month from vencimento (due date = closing + 1 month)
      const vencMatch = text.match(VENCIMENTO_YEAR_RE);
      if (vencMatch) {
        const vencMonth = parseInt(vencMatch[2], 10);
        if (vencMonth === 1) {
          closingMonth = 12;
          statementYear = parseInt(vencMatch[3], 10) - 1;
        } else {
          closingMonth = vencMonth - 1;
          statementYear = parseInt(vencMatch[3], 10);
        }
      }
    }

    const transactions: Transaction[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line || PAGE_BREAK_RE.test(line)) continue;
      if (CARD_HEADER_RE.test(line) || SUBTOTAL_RE.test(line)) continue;

      const match = line.match(TXN_LINE_RE);
      if (!match) continue;

      const [, day, monthAbbr, rawDesc, rawAmount] = match;
      const month = PT_MONTHS[monthAbbr.toLowerCase()];
      if (!month) continue;

      const monthNum = parseInt(month, 10);

      // Determine year: months after closing month belong to previous year
      let txnYear = statementYear;
      if (closingMonth > 0 && monthNum > closingMonth) {
        txnYear = statementYear - 1;
      }

      const date = `${txnYear}-${month}-${day.padStart(2, '0')}`;
      const amount = parseBRAmount(rawAmount);
      if (amount === 0) continue;

      let description = rawDesc.trim();
      let isCredit = false;

      // Detect credits: "Estorno" or "Inclusao de Pagamento"
      if (/- Estorno$/i.test(description) || /^Inclusao de Pagamento$/i.test(description)) {
        isCredit = true;
      }

      description = description.replace(/\s+/g, ' ').trim();

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
