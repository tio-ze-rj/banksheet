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
    const txnLineRegex = /^(\d{2}\/\d{2})\s+(.+?)(\d{1,3}(?:\.\d{3})*,\d{2})(-)?\s*$/;

    for (const line of sectionLines) {
      // Skip card holder headers, subtotals, column headers, empty lines
      if (
        /^Cart[aã]o\s+\d{4}/i.test(line) ||
        /^Total\s+para/i.test(line) ||
        /^Data\s*Hist[oó]rico/i.test(line) ||
        /^Cota[cç][aã]o/i.test(line) ||
        /^do\s+D[oó]lar/i.test(line) ||
        /^R\$$/i.test(line) ||
        /^US\$$/i.test(line) ||
        /^N[uú]mero do Cart[aã]o/i.test(line) ||
        !line
      ) {
        continue;
      }

      // Skip card holder name lines (all uppercase, no digits at start)
      if (/^[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ\s]+$/.test(line) && !/^\d/.test(line)) {
        continue;
      }

      const match = line.match(txnLineRegex);
      if (!match) continue;

      const [, dateStr, rawDesc, rawAmount, creditSign] = match;
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

      // Remove installment NN/NN + city: "CASA CARIOCA        02/02RESENDE"
      const installmentCityRegex = /(\d{2}\/\d{2})([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][A-ZÁÀÃÂÉÊÍÓÔÕÚÇa-záàãâéêíóôõúç\s]+)$/;
      const instCityMatch = description.match(installmentCityRegex);
      if (instCityMatch) {
        description = description.slice(0, instCityMatch.index!) + instCityMatch[1];
      } else {
        // Try to strip known city from end of description
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
        raw: line,
      });
    }

    return transactions;
  },
};
