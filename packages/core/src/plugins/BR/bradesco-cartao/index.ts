import type { BankParser, Transaction } from '../../../types';
import { parseBRAmount } from '../utils';

export const bradescoCartaoParser: BankParser = {
  name: 'Bradesco Cartão',
  country: 'BR',

  detect(text: string): boolean {
    return (
      /Bradesco\s*Cart[oõ]es/i.test(text) ||
      /Banco\s*Bradesco\s*S\/?A/i.test(text) ||
      /banco\.bradesco/i.test(text)
    );
  },

  parse(text: string): Transaction[] {
    const currentYear = new Date().getFullYear();
    const lines = text.split('\n').map(l => l.trim());

    // Find the "Lançamentos" section
    const startIdx = lines.findIndex(l => /^Lan[cç]amentos$/i.test(l));
    if (startIdx === -1) return [];

    // End at "Total da fatura em real" or "Total parcelados"
    const endIdx = lines.findIndex(
      (l, i) => i > startIdx && /^Total da fatura em real/i.test(l)
    );
    const sectionLines = lines.slice(startIdx + 1, endIdx === -1 ? undefined : endIdx);

    const transactions: Transaction[] = [];

    // A transaction begins with DD/DD. Depending on the PDF layout, pdfjs may
    // emit the whole row on one line ("25/05 CLINICA 783,34") or wrap the
    // description/city and even the amount onto following lines. So we assemble
    // logical records: start at a DD/DD line, then absorb continuation lines
    // until the amount is found (trailing "-" = credit, optionally space-separated).
    const txnStartRegex = /^(\d{2}\/\d{2})\s+(.*)$/;
    const amountRegex = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*(-)?\s*$/;

    // Lines that end the current record without belonging to it (holder
    // subtotals, card-holder headers, column headers, section markers).
    const isBoundary = (line: string): boolean =>
      /^Total\s+para/i.test(line) ||
      /^Total da fatura/i.test(line) ||
      /Cart[aã]o\s+\d{4}/i.test(line) ||
      /^Data\s*Hist[oó]rico/i.test(line) ||
      /^Cota[cç][aã]o/i.test(line) ||
      /^do\s+D[oó]lar/i.test(line) ||
      /^R\$$/i.test(line) ||
      /^US\$$/i.test(line) ||
      /^N[uú]mero do Cart[aã]o/i.test(line);

    // Build the list of raw transaction records (each: date + combined rest).
    const records: Array<{ dateStr: string; body: string }> = [];
    let current: { dateStr: string; parts: string[] } | null = null;

    const flush = () => {
      if (current) {
        records.push({ dateStr: current.dateStr, body: current.parts.join(' ') });
        current = null;
      }
    };

    for (const line of sectionLines) {
      if (!line) continue;

      const startMatch = line.match(txnStartRegex);
      if (startMatch) {
        // New transaction row — close any open one first.
        flush();
        current = { dateStr: startMatch[1], parts: [startMatch[2]] };
        // If the amount is already on this line, the record is complete.
        if (amountRegex.test(startMatch[2])) {
          flush();
        }
        continue;
      }

      if (isBoundary(line)) {
        // Subtotal/header line: the previous record must already be complete;
        // if it wasn't (amount not yet seen) drop it — it's malformed.
        current = null;
        continue;
      }

      // Continuation line for the open record (wrapped description/city/amount).
      if (current) {
        current.parts.push(line);
        if (amountRegex.test(line)) {
          flush();
        }
      }
    }
    flush();

    for (const { dateStr, body } of records) {
      const amountMatch = body.match(amountRegex);
      if (!amountMatch) continue;

      const rawAmount = amountMatch[1];
      const creditSign = amountMatch[2];
      const rawDesc = body.slice(0, amountMatch.index).trim();
      const [day, month] = dateStr.split('/');
      const date = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      // Parse amount: BR format (1.234,56) -> number
      const numericAmount = parseBRAmount(rawAmount);

      // Credit card: positive = expense (negative), trailing `-` = payment/credit (positive)
      const isCredit = !!creditSign;
      const amount = isCredit ? numericAmount : -numericAmount;
      const type = isCredit ? 'credit' as const : 'debit' as const;

      // Clean description: remove trailing city and installment info
      let description = rawDesc.trim();

      // Known Brazilian city names that appear in Bradesco statements.
      // pdf-parse glues column text together, so city is stuck to description.
      const cities = [
        'SAO PAULO', 'RIO DE JANEIRO', 'BELO HORIZONTE', 'BRASILIA',
        'CURITIBA', 'PORTO ALEGRE', 'SALVADOR', 'RECIFE', 'FORTALEZA',
        'MANAUS', 'BELEM', 'GOIANIA', 'CAMPINAS', 'GUARULHOS',
        'SAO BERNARDO', 'SANTO ANDRE', 'OSASCO', 'NITEROI', 'RESENDE',
        'VOLTA REDONDA', 'PETROPOLIS', 'TERESOPOLIS', 'JUIZ DE FORA',
        'FLORIANOPOLIS', 'VITORIA', 'NATAL', 'MACEIO', 'JOAO PESSOA',
        'ARACAJU', 'CAMPO GRANDE', 'CUIABA', 'MACAPA', 'PALMAS',
        'RIO BRANCO', 'BOA VISTA', 'PORTO VELHO', 'SAO LUIS',
        'TERESINA', 'SAO JOSE', 'LONDRINA', 'MARINGA', 'JOINVILLE',
        'UBERLANDIA', 'SOROCABA', 'RIBEIRAO PRETO', 'SAO GONCALO',
      ];

      // Remove installment NN/NN + glued city: "CASA CARIOCA        02/02RESENDE"
      const installmentCityRegex = /(\d{2}\/\d{2})([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][A-ZÁÀÃÂÉÊÍÓÔÕÚÇa-záàãâéêíóôõúç\s]+)$/;
      const instCityMatch = description.match(installmentCityRegex);
      if (instCityMatch) {
        description = description.slice(0, instCityMatch.index!) + instCityMatch[1];
      } else {
        // Try to strip known city from end of description. In wrapped layouts
        // the city is a separate token ("... 01/12 VOLTA REDONDA"); in glued
        // layouts it abuts the description ("...ODONTOSAO PAULO"). endsWith
        // covers both since we only strip the trailing city substring.
        for (const city of cities) {
          if (description.endsWith(city)) {
            const stripped = description.slice(0, -city.length).trim();
            if (stripped.length > 0) {
              description = stripped;
              break;
            }
          }
        }
      }

      description = description.replace(/\s+/g, ' ').trim();

      transactions.push({
        date,
        description,
        amount,
        currency: 'BRL',
        type,
        raw: `${dateStr} ${body}`.trim(),
      });
    }

    return transactions;
  },
};
