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

    // A transaction segment: DD/MM, description, optional installment NN/NN,
    // optional "-" (credit) and the amount. Itaú prints two columns side by
    // side and pdfjs merges them into a single line, so one line can carry
    // several segments — sometimes glued ("174,3215/08 …") or preceded by a
    // label ("…serviços25/09 …"). Scan every segment instead of reading only
    // the line's trailing amount, which would pick up the other column's value.
    const segmentRegex =
      /(?<=^|\s|,\d{2}|[A-Za-zÀ-ÿ])(\d{2})\/(\d{2})(?![/\d])\s*(.+?)\s*(?:(\d{2})\/(\d{2})\s*)?(-\s?)?(\d{1,3}(?:\.\d{3})*,\d{2})(?=\s|$|\d{2}\/\d{2})/g;
    // Start of the "Compras parceladas - próximas faturas" block.
    const futureMarkerRegex = /Compras parceladas\s*-\s*pr[óo]ximas\s*faturas/i;

    // A parsed transaction carries the installment number (0 = not an
    // installment) and whether it appears after the future-installments marker,
    // so the "próximas faturas" block can be stripped later.
    interface ParsedTxn extends Transaction {
      installmentNum: number;
      afterFutureMarker: boolean;
    }

    const allLines = text.split('\n').map((line: string) => line.trim());

    let futureMarkerSeen = false;
    const parsed: ParsedTxn[] = allLines.flatMap((line: string): ParsedTxn[] => {
      const markerMatch = line.match(futureMarkerRegex);
      const markerIndex = markerMatch ? markerMatch.index! : -1;
      const lineStartsAfterMarker = futureMarkerSeen;
      if (markerMatch) futureMarkerSeen = true;

      return [...line.matchAll(segmentRegex)].flatMap((m): ParsedTxn[] => {
        const [, day, month, rawDesc, instA, instB, negSign, rawAmount] = m;
        if (!/[A-Za-z*]/.test(rawDesc)) return [];

        let installmentNum = 0;
        let descPart = rawDesc;
        if (instA && instB) {
          const instNum = parseInt(instA, 10);
          const instTotal = parseInt(instB, 10);
          if (instNum >= 1 && instTotal >= 1 && instNum <= instTotal && instTotal <= 99) {
            installmentNum = instNum;
          } else {
            descPart = `${rawDesc} ${instA}/${instB}`;
          }
        }

        const isNegative = !!negSign;
        const numericAmount = parseBRAmount(rawAmount);

        // Credit card: positive in statement = expense (negative amount)
        // Negative in statement = refund/credit (positive amount)
        const amount = isNegative ? numericAmount : -numericAmount;
        const type = isNegative ? 'credit' as const : 'debit' as const;

        const date = `${currentYear}-${month}-${day}`;

        // Clean trailing digits (card-final numbers, installment counts)
        descPart = descPart.trim().replace(/\d+$/, '').trim();
        // Remove trailing dash from negative prefix residue
        descPart = descPart.replace(/-$/, '').trim();

        return [{
          date,
          description: descPart,
          amount,
          currency: 'BRL',
          type,
          raw: m[0],
          installmentNum,
          afterFutureMarker:
            lineStartsAfterMarker || (markerIndex >= 0 && m.index! > markerIndex),
        }];
      });
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
    let kept: ParsedTxn[] = [...parsed];
    const printedTotalMatch = text.match(
      /Total dos lan[çc]amentos atuais\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
    );

    if (printedTotalMatch) {
      // Preferred path: reconcile against the statement's own control total.
      // Expenses are stored as negative amounts; the printed total is a positive
      // magnitude. Compare magnitudes of the summed charges (+ IOF surcharge).
      const printedTotal = parseBRAmount(printedTotalMatch[1]);
      const magnitudeOf = (txns: ParsedTxn[]): number =>
        Math.abs(txns.reduce((sum, t) => sum + t.amount, 0) - iofAmount);
      const currentMagnitude = (): number => magnitudeOf(kept);

      // Two-column layout: the future block is interleaved with current
      // charges, so it is not a trailing run. When the marker is present, drop
      // the installments (parcela >= 2) that follow it — provided that makes
      // the books balance.
      const withoutMarked = kept.filter(
        t => !(t.afterFutureMarker && t.installmentNum >= 2),
      );
      if (
        withoutMarked.length < kept.length &&
        Math.abs(magnitudeOf(withoutMarked) - printedTotal) <= 0.005
      ) {
        kept = withoutMarked;
      }

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

    const transactions: Transaction[] = kept.map(({ installmentNum: _n, afterFutureMarker: _f, ...t }) => t);

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
