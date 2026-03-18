import type { BankParser, Transaction } from '../../../types';
import { parseBRAmount } from '../utils';

export const itauCartaoParser: BankParser = {
  name: 'Itaú Cartão',
  country: 'BR',

  detect(text: string): boolean {
    return (
      /VISA\s+INFINITY/i.test(text) ||
      /ITAUUNIBANCO/i.test(text) ||
      /Banco\s*Itaú/i.test(text) ||
      /BancoItaúS\.A/i.test(text)
    );
  },

  parse(text: string): Transaction[] {
    const currentYear = new Date().getFullYear();

    const dateLineRegex = /^\d{2}\/\d{2}(?!\/)/;
    const withInstallmentRegex = /(\d{2})\/(\d{2})(\d{1,3}(?:\.\d{3})*,\d{2})$/;
    const simpleAmountRegex = /(- ?)?(\d{1,3}(?:\.\d{3})*,\d{2})$/;

    const lines = text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => dateLineRegex.test(line) && line.length > 5);

    const transactions = lines.flatMap((line: string): Transaction[] => {
      let isNegative = false;
      let rawAmount: string;
      let descEnd: number;

      // Try installment pattern first: ...NN/NNvalue
      const instMatch = line.match(withInstallmentRegex);
      if (instMatch) {
        const instNum = parseInt(instMatch[1], 10);
        const instTotal = parseInt(instMatch[2], 10);
        if (instNum >= 1 && instTotal >= 1 && instNum <= instTotal && instTotal <= 99) {
          rawAmount = instMatch[3];
          descEnd = instMatch.index!;
        } else {
          const simpleMatch = line.match(simpleAmountRegex);
          if (!simpleMatch) return [];
          isNegative = !!simpleMatch[1];
          rawAmount = simpleMatch[2];
          descEnd = simpleMatch.index!;
        }
      } else {
        const simpleMatch = line.match(simpleAmountRegex);
        if (!simpleMatch) return [];
        isNegative = !!simpleMatch[1];
        rawAmount = simpleMatch[2];
        descEnd = simpleMatch.index!;
      }

      const numericAmount = parseBRAmount(rawAmount);

      // Credit card: positive in statement = expense (negative amount)
      // Negative in statement = refund/credit (positive amount)
      const amount = isNegative ? numericAmount : -numericAmount;
      const type = isNegative ? 'credit' as const : 'debit' as const;

      // Parse date: DD/MM -> YYYY-MM-DD
      const [day, month] = line.substring(0, 5).split('/');
      const date = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      // Description: between date (5 chars) and the tail match
      let descPart = line.substring(5, descEnd).trim();

      // Clean trailing digits (card-final numbers, installment counts)
      descPart = descPart.replace(/\d+$/, '').trim();
      // Remove trailing dash from negative prefix residue
      descPart = descPart.replace(/-$/, '').trim();

      return [{
        date,
        description: descPart,
        amount,
        currency: 'BRL',
        type,
        raw: line,
      }];
    });

    // Itaú international transactions include an IOF surcharge line that isn't
    // formatted as a transaction. Extract it from the summary section.
    const iofMatch = text.match(/Repassede IOF em R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/);
    if (iofMatch) {
      transactions.push({
        date: `${currentYear}-01-01`, // no specific date in summary
        description: 'IOF REPASSE TRANSAÇÕES INTERNACIONAIS',
        amount: -parseBRAmount(iofMatch[1]),
        currency: 'BRL',
        type: 'debit' as const,
        raw: iofMatch[0],
      });
    }

    // Itaú PDFs repeat installment transactions in a "próximas faturas" section
    // with the next month's installment number. Deduplicate by keeping only the
    // first occurrence of each (description, amount) pair for installment lines.
    const seen = new Set<string>();
    return transactions.filter(t => {
      const hasInstallment = /\d{2}\/\d{2}\d{1,3}(?:\.\d{3})*,\d{2}$/.test(t.raw ?? '');
      if (!hasInstallment) return true;
      const key = `${t.description}|${t.amount}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
};
