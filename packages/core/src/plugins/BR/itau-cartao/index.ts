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
    // Installment tail. Amount may be glued (…02/03169,90) or space-separated
    // (…02/12 105,00), so allow optional whitespace before the amount.
    const withInstallmentRegex = /(\d{2})\/(\d{2})\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
    const simpleAmountRegex = /(- ?)?(\d{1,3}(?:\.\d{3})*,\d{2})$/;

    // A parsed transaction carries the installment number (0 = not an
    // installment) so we can later strip the "próximas faturas" trailing run.
    interface ParsedTxn extends Transaction {
      installmentNum: number;
    }

    // pdfjs sometimes bleeds a single stray column letter onto the front of a
    // transaction row (e.g. "L27/06 MERCADOLIVRE..." from the "Lançamentos"
    // header column). Strip a lone leading letter that directly precedes a
    // DD/DD date so the row is recognised as a transaction.
    const allLines = text
      .split('\n')
      .map((line: string) => line.trim())
      .map((line: string) => line.replace(/^[A-Za-z](?=\d{2}\/\d{2}(?!\/))/, ''));

    const parsed: ParsedTxn[] = allLines.flatMap((line: string): ParsedTxn[] => {
      if (!dateLineRegex.test(line) || line.length <= 5) return [];

      let isNegative = false;
      let rawAmount: string;
      let descEnd: number;
      let installmentNum = 0;

      // Try installment pattern first: ...NN/NN[ ]value
      const instMatch = line.match(withInstallmentRegex);
      if (instMatch) {
        const instNum = parseInt(instMatch[1], 10);
        const instTotal = parseInt(instMatch[2], 10);
        if (instNum >= 1 && instTotal >= 1 && instNum <= instTotal && instTotal <= 99) {
          rawAmount = instMatch[3];
          descEnd = instMatch.index!;
          installmentNum = instNum;
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
        installmentNum,
      }];
    });

    // Itaú international transactions include an IOF surcharge line that isn't
    // formatted as a transaction. Extract it from the summary section. The label
    // is "Repasse de IOF em R$" — pdfjs may or may not preserve the spaces. It is
    // part of "Total dos lançamentos atuais", so account for it during
    // reconciliation below.
    const iofMatch = text.match(/Repasse\s*de IOF em R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/);
    const iofAmount = iofMatch ? parseBRAmount(iofMatch[1]) : 0;

    // Drop the "Compras parceladas - próximas faturas" block. pdfjs decouples the
    // section label from the value column, so the future block has no inline
    // header. It is the trailing run of *future* installment lines (parcela >= 2).
    //
    // To avoid dropping a legitimate current charge that merely happens to be a
    // mid-cycle installment at the end of the list, we anchor on the statement's
    // own printed control total ("Total dos lançamentos atuais"): pop trailing
    // installment lines only while the running current-total still exceeds the
    // printed figure. When the sums already agree, nothing is dropped.
    const kept: ParsedTxn[] = [...parsed];
    const printedTotalMatch = text.match(
      /Total dos lan[çc]amentos atuais\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
    );

    if (printedTotalMatch) {
      // Preferred path: reconcile against the statement's own control total.
      // Expenses are stored as negative amounts; the printed total is a positive
      // magnitude. Compare magnitudes of the summed charges (+ IOF surcharge).
      const printedTotal = parseBRAmount(printedTotalMatch[1]);
      const currentMagnitude = (): number =>
        Math.abs(kept.reduce((sum, t) => sum + t.amount, 0) - iofAmount);

      // Only ever pop future installment lines (parcela >= 2), never a
      // non-installment current charge. Stop as soon as the books balance — so a
      // legitimate trailing current installment is never dropped.
      while (
        kept.length > 0 &&
        kept[kept.length - 1].installmentNum >= 2 &&
        currentMagnitude() - printedTotal > 0.005
      ) {
        kept.pop();
      }
    } else {
      // Fallback (no printed total found): pop the maximal trailing run of
      // future installment lines. Less precise, but avoids re-inflating the
      // total with the "próximas faturas" block.
      while (kept.length > 0 && kept[kept.length - 1].installmentNum >= 2) {
        kept.pop();
      }
    }

    const transactions: Transaction[] = kept.map(({ installmentNum: _n, ...t }) => t);

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

    return transactions;
  },
};
