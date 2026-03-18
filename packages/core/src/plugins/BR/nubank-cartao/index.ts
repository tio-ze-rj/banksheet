import type { BankParser, Transaction } from '../../../types';
import { PT_MONTHS, parseBRAmount } from '../utils';

// Hoisted regexes — compiled once at module load
const TXN_DATE_RE = /^(\d{1,2})\s+([A-Z]{3})\s+(.+)/;
const FATURA_YEAR_RE = /FATURA\s+\d{1,2}\s+[A-Z]{3}\s+(\d{4})/;
const CREDIT_RE = /^(.+?)\s*[−-]R\$\s*([\d.,]+)\s*$/;
const DEBIT_RE = /^(.+?)\s+R\$\s*([\d.,]+)\s*$/;
const NEXT_CREDIT_RE = /^[−-]R\$\s*([\d.,]+)\s*$/;
const NEXT_DEBIT_RE = /^R\$\s*([\d.,]+)\s*$/;
const PAGE_BREAK_RE = /^--- PAGE BREAK ---/;
const CATEGORY_HEADER_RE = /^[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][a-záàãâéêíóôõúç\s]+[-−]?R\$\s*[\d.,]+$/;
const HOLDER_TOTAL_RE = /^[A-Z][a-zA-ZÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç\s]+R\$\s*[\d.,]+$/;

const SKIP_PATTERNS = [
  /^USD\s/i,
  /^Conversão:/i,
  /^Saldo restante/i,
  /^Em cumprimento/i,
  /^Como assegurado/i,
  /^\d+\s+de\s+\d+$/,
];

export const nubankCartaoParser: BankParser = {
  name: 'Nubank Cartão',
  country: 'BR',

  detect(text: string): boolean {
    return (
      /Nu\s*Pagamentos\s*S\.?A\.?/i.test(text) ||
      /CNPJ\s*18\.236\.120/i.test(text) ||
      /nubank/i.test(text)
    );
  },

  parse(text: string): Transaction[] {
    const lines = text.split('\n').map(l => l.trim());

    // Extract year from "FATURA DD MMM YYYY" header
    const yearMatch = text.match(FATURA_YEAR_RE);
    const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

    const startIdx = lines.findIndex(l => /^TRANSAÇÕES DE/i.test(l));
    if (startIdx === -1) return [];

    const transactions: Transaction[] = [];

    let i = startIdx + 1;
    while (i < lines.length) {
      const line = lines[i];

      if (!line || SKIP_PATTERNS.some(p => p.test(line))) {
        i++;
        continue;
      }

      // Skip card holder total lines and category headers
      if ((HOLDER_TOTAL_RE.test(line) || CATEGORY_HEADER_RE.test(line)) && !TXN_DATE_RE.test(line)) {
        i++;
        continue;
      }

      if (PAGE_BREAK_RE.test(line)) {
        i++;
        continue;
      }

      const dateMatch = line.match(TXN_DATE_RE);
      if (!dateMatch) {
        i++;
        continue;
      }

      const [, day, monthAbbr, rest] = dateMatch;
      const month = PT_MONTHS[monthAbbr.toLowerCase()];
      if (!month) {
        i++;
        continue;
      }

      const date = `${year}-${month}-${day.padStart(2, '0')}`;

      if (/Saldo restante/i.test(rest)) {
        i++;
        continue;
      }

      // Credit (payment): "Description −R$ AMOUNT"
      const creditMatch = rest.match(CREDIT_RE);
      if (creditMatch) {
        const [, desc, rawAmount] = creditMatch;
        const amount = parseBRAmount(rawAmount);
        if (amount === 0) { i++; continue; }
        transactions.push({
          date,
          description: desc.trim(),
          amount,
          currency: 'BRL',
          type: 'credit',
          raw: line,
        });
        i++;
        continue;
      }

      // Debit: "Description R$ AMOUNT"
      const debitMatch = rest.match(DEBIT_RE);
      if (debitMatch) {
        const [, desc, rawAmount] = debitMatch;
        const amount = parseBRAmount(rawAmount);
        if (amount === 0) { i++; continue; }
        transactions.push({
          date,
          description: desc.trim(),
          amount: -amount,
          currency: 'BRL',
          type: 'debit',
          raw: line,
        });
        i++;
        continue;
      }

      // Amount on subsequent line (international purchases)
      const description = rest.trim();
      let foundAmount = false;

      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j];
        if (SKIP_PATTERNS.some(p => p.test(nextLine)) || !nextLine) continue;

        const nextCreditMatch = nextLine.match(NEXT_CREDIT_RE);
        if (nextCreditMatch) {
          const amount = parseBRAmount(nextCreditMatch[1]);
          if (amount > 0) {
            transactions.push({ date, description, amount, currency: 'BRL', type: 'credit', raw: line });
          }
          i = j + 1;
          foundAmount = true;
          break;
        }

        const nextDebitMatch = nextLine.match(NEXT_DEBIT_RE);
        if (nextDebitMatch) {
          const amount = parseBRAmount(nextDebitMatch[1]);
          if (amount > 0) {
            transactions.push({ date, description, amount: -amount, currency: 'BRL', type: 'debit', raw: line });
          }
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
