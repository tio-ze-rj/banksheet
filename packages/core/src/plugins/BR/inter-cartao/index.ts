import type { BankParser, Transaction } from '../../../types';
import { PT_MONTHS, parseBRAmount } from '../utils';

// Hoisted regexes — compiled once at module load
const TXN_DATE_RE = /^(\d{1,2})\s+de\s+(\w{3})\.\s+(\d{4})\s+(.+)/;
const AMOUNT_ON_LINE_RE = /^(.+?)\s*-\s*(\+\s*)?R\$\s*([\d.,]+)\s*$/;
const NEXT_AMOUNT_RE = /^(-\s*)?(\+\s*)?R\$\s*([\d.,]+)\s*$/;
const LIMIT_RE = /^Limite de cr[eé]dito total/i;
const NEXT_FATURA_RE = /^Pr[oó]xima fatura/i;
const PAGE_BREAK_RE = /^--- PAGE BREAK ---/;

const SKIP_PATTERNS = [
  /^Valor e s[ií]mbolo da moeda/i,
  /^Valor em d[oó]lar/i,
  /^Cota[cç][aã]o do d[oó]lar/i,
  /^Total\s+CART[AÃ]O/i,
  /^CART[AÃ]O\s+\d{4}/i,
  /^Data\s+Movimenta[cç][aã]o/i,
];

export const interCartaoParser: BankParser = {
  name: 'Inter Cartão',
  country: 'BR',

  detect(text: string): boolean {
    return (
      /BANCO\s*INTER\s*S\/?A/i.test(text) ||
      /bancointer\.com\.br/i.test(text) ||
      /Banco\s*Inter/i.test(text) ||
      /Cart[aã]o\s*Inter/i.test(text)
    );
  },

  parse(text: string): Transaction[] {
    const lines = text.split('\n').map(l => l.trim());

    const startIdx = lines.findIndex(l => /^Despesas da fatura$/i.test(l));
    if (startIdx === -1) return [];

    const transactions: Transaction[] = [];

    let i = startIdx + 1;
    while (i < lines.length) {
      const line = lines[i];

      // Stop at limit/summary sections
      if (LIMIT_RE.test(line) || NEXT_FATURA_RE.test(line)) break;

      // Skip page breaks
      if (PAGE_BREAK_RE.test(line)) {
        i++;
        continue;
      }

      // Skip non-transaction lines
      if (!line || SKIP_PATTERNS.some(p => p.test(line))) {
        i++;
        continue;
      }

      const dateMatch = line.match(TXN_DATE_RE);
      if (!dateMatch) {
        i++;
        continue;
      }

      const [, day, monthAbbr, year, rest] = dateMatch;
      const month = PT_MONTHS[monthAbbr.toLowerCase()];
      if (!month) {
        i++;
        continue;
      }

      const date = `${year}-${month}-${day.padStart(2, '0')}`;

      // Try amount on same line: "DESCRIPTION - [+] R$ AMOUNT"
      const amountOnLineMatch = rest.match(AMOUNT_ON_LINE_RE);

      if (amountOnLineMatch) {
        const [, desc, plusSign, rawAmount] = amountOnLineMatch;
        const amount = parseBRAmount(rawAmount);
        const isCredit = !!plusSign;

        transactions.push({
          date,
          description: desc.trim(),
          amount: isCredit ? amount : -amount,
          currency: 'BRL',
          type: isCredit ? 'credit' : 'debit',
          raw: line,
        });
        i++;
        continue;
      }

      // Amount on next line (international purchases)
      const descFromRest = rest.replace(/\s*-\s*$/, '').trim();
      let foundAmount = false;

      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j];
        if (SKIP_PATTERNS.some(p => p.test(nextLine))) continue;

        const nextAmountMatch = nextLine.match(NEXT_AMOUNT_RE);
        if (nextAmountMatch) {
          const [, , plusSign, rawAmount] = nextAmountMatch;
          const amount = parseBRAmount(rawAmount);
          const isCredit = !!plusSign;

          transactions.push({
            date,
            description: descFromRest,
            amount: isCredit ? amount : -amount,
            currency: 'BRL',
            type: isCredit ? 'credit' : 'debit',
            raw: line,
          });
          i = j + 1;
          foundAmount = true;
          break;
        }

        if (TXN_DATE_RE.test(nextLine)) break;
      }

      if (!foundAmount) {
        i++;
      }
    }

    return transactions;
  },
};
