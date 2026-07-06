import { describe, it, expect } from 'vitest';
import { itauCartaoParser } from '../index';

// Itaú PDF text has no spaces between fields - everything is glued together
const SAMPLE_TEXT = `
BancoItaúS.A.341-734191
ITAUUNIBANCOHOLDINGS.A. - 60.872.504/0001-23
04/02NETFLIX.COM44,90
06/02MP*NATALIADA-CT61,00
09/02PROQUALITYP-CT U 01/03169,90
24/01LOJASRENNER-CT1802/03171,70
15/12AMAZONBR- 196,30
02/02PAGAMENTOEFETUADO6258- 2.500,00
25/01SHOPEE*SHPSTECNOLOGIA- 0,02
22/02ROYALCENTER-CT1.135,29
12/02PETLOVE*Order211173,61
`;

// Current charges, then a trailing "próximas faturas" run (parcela >= 2),
// then the "Limite total de crédito" marker — the real statement shape. The
// NETFLIX line (non-installment) separates current from the future run.
const TEXT_WITH_FUTURE = `
ITAUUNIBANCOHOLDINGS.A.
09/02PROQUALITYP-CT U 01/03169,90
04/02NETFLIX.COM44,90
09/02PROQUALITYP-CT U 02/03169,90
24/01LOJASRENNER-CT1802/03171,70
Limite total de crédito
`;

const TEXT_WITH_IOF = `
ITAUUNIBANCOHOLDINGS.A.
04/02NETFLIX.COM44,90
Repassede IOF em R$30,00
`;

const UNRELATED_TEXT = `
NUBANK
Fatura de março
Compra no débito
`;

describe('Itaú Cartão Parser', () => {
  describe('detect', () => {
    it('detects by ITAUUNIBANCO', () => {
      expect(itauCartaoParser.detect('ITAUUNIBANCOHOLDINGS.A.')).toBe(true);
    });

    it('detects by BancoItaú', () => {
      expect(itauCartaoParser.detect('BancoItaúS.A.341')).toBe(true);
    });

    it('detects by VISA INFINITY', () => {
      expect(itauCartaoParser.detect('VISA INFINITY')).toBe(true);
    });

    it('does not detect unrelated statements', () => {
      expect(itauCartaoParser.detect(UNRELATED_TEXT)).toBe(false);
    });
  });

  describe('parse - basic transactions', () => {
    it('parses simple transaction (no spaces)', () => {
      const txns = itauCartaoParser.parse(SAMPLE_TEXT);
      const netflix = txns.find(t => t.description === 'NETFLIX.COM');
      expect(netflix).toBeDefined();
      expect(netflix!.amount).toBe(-44.9);
      expect(netflix!.type).toBe('debit');
    });

    it('extracts date as ISO 8601', () => {
      const txns = itauCartaoParser.parse(SAMPLE_TEXT);
      const netflix = txns.find(t => t.description === 'NETFLIX.COM');
      expect(netflix!.date).toMatch(/^\d{4}-02-04$/);
    });

    it('sets currency to BRL', () => {
      const txns = itauCartaoParser.parse(SAMPLE_TEXT);
      expect(txns[0].currency).toBe('BRL');
    });

    it('preserves raw line', () => {
      const txns = itauCartaoParser.parse(SAMPLE_TEXT);
      const netflix = txns.find(t => t.description === 'NETFLIX.COM');
      expect(netflix!.raw).toBe('04/02NETFLIX.COM44,90');
    });

    it('parses thousand-separator amounts', () => {
      const txns = itauCartaoParser.parse(SAMPLE_TEXT);
      const royal = txns.find(t => t.description === 'ROYALCENTER-CT');
      expect(royal).toBeDefined();
      expect(royal!.amount).toBe(-1135.29);
    });
  });

  describe('parse - refunds/credits', () => {
    it('parses negative amounts (refund) as positive credit', () => {
      const txns = itauCartaoParser.parse(SAMPLE_TEXT);
      const amazon = txns.find(t => t.description === 'AMAZONBR');
      expect(amazon).toBeDefined();
      expect(amazon!.amount).toBe(196.3);
      expect(amazon!.type).toBe('credit');
    });

    it('parses small refunds', () => {
      const txns = itauCartaoParser.parse(SAMPLE_TEXT);
      const shopeeRefund = txns.find(t => t.description === 'SHOPEE*SHPSTECNOLOGIA');
      expect(shopeeRefund).toBeDefined();
      expect(shopeeRefund!.amount).toBe(0.02);
      expect(shopeeRefund!.type).toBe('credit');
    });

    it('parses payment as credit with card-final digits stripped', () => {
      const txns = itauCartaoParser.parse(SAMPLE_TEXT);
      const payment = txns.find(t => t.description === 'PAGAMENTOEFETUADO');
      expect(payment).toBeDefined();
      expect(payment!.amount).toBe(2500);
      expect(payment!.type).toBe('credit');
    });
  });

  describe('parse - installments', () => {
    it('separates installment NN/NN from amount', () => {
      const txns = itauCartaoParser.parse(SAMPLE_TEXT);
      const proquality = txns.find(t => t.description === 'PROQUALITYP-CT U');
      expect(proquality).toBeDefined();
      expect(proquality!.amount).toBe(-169.9);
    });

    it('strips trailing digits before installment pattern', () => {
      const txns = itauCartaoParser.parse(SAMPLE_TEXT);
      const renner = txns.find(t => t.description === 'LOJASRENNER-CT');
      expect(renner).toBeDefined();
      expect(renner!.amount).toBe(-171.7);
    });

    it('handles digit-prefixed descriptions with installment', () => {
      const txns = itauCartaoParser.parse(SAMPLE_TEXT);
      const petlove = txns.find(t => t.description === 'PETLOVE*Order');
      expect(petlove).toBeDefined();
      expect(petlove!.amount).toBe(-173.61);
    });
  });

  describe('excludes próximas faturas - future installment run', () => {
    it('keeps the current first installment (parcela 1)', () => {
      const txns = itauCartaoParser.parse(TEXT_WITH_FUTURE);
      const proquality = txns.filter(t => t.description === 'PROQUALITYP-CT U');
      expect(proquality).toHaveLength(1);
      expect(proquality[0].amount).toBe(-169.9);
    });

    it('drops the trailing future installment run (parcela >= 2)', () => {
      const txns = itauCartaoParser.parse(TEXT_WITH_FUTURE);
      // The second PROQUALITY (02/03) and LOJASRENNER (02/03) are the future run.
      expect(txns.filter(t => t.description === 'LOJASRENNER-CT')).toHaveLength(0);
      // Only the current PROQUALITY + NETFLIX remain.
      const total = txns.reduce((sum, t) => sum + t.amount, 0);
      expect(total).toBeCloseTo(-214.8, 2); // -169.90 - 44.90
    });

    it('keeps non-installment current charges', () => {
      const txns = itauCartaoParser.parse(TEXT_WITH_FUTURE);
      expect(txns.find(t => t.description === 'NETFLIX.COM')).toBeDefined();
    });
  });

  describe('IOF extraction', () => {
    it('extracts IOF surcharge from summary', () => {
      const txns = itauCartaoParser.parse(TEXT_WITH_IOF);
      const iof = txns.find(t => t.description.includes('IOF'));
      expect(iof).toBeDefined();
      expect(iof!.amount).toBe(-30);
      expect(iof!.type).toBe('debit');
    });
  });

  // Real-statement layout: pdfjs extracts space-separated columns, and the
  // "Compras parceladas - próximas faturas" (future installments) block appears
  // as a trailing run of installment lines (parcela >= 2) right before the
  // "Limite total de crédito" marker. These are NOT part of the current invoice
  // and must be excluded, or the total is inflated (regression: summed future
  // expenses → 17.153,64 instead of the correct 16.153,55).
  describe('parse - excludes próximas faturas (trailing installment run)', () => {
    // Space-separated real layout. Current charges, then the future block.
    const STATEMENT = [
      'Banco Itaú S.A. 341-7',
      'ITAU UNIBANCO HOLDING S.A.',
      // --- current charges ---
      '11/05 PROQUALITY P-CT U 02/03 169,90',   // current installment (parcela 2/3)
      '02/06 AWS Brazil 120,27',
      '03/06 ANUIDADE DIFERENCI 02/12 105,00',  // current installment (parcela 2/12)
      '02/07 ESTORNO DE ANUIDADE DIF - 52,50',  // current credit (non-installment)
      // --- Compras parceladas - próximas faturas (trailing installment run) ---
      '11/05 PROQUALITY P-CT U 03/03 169,90',   // future (parcela 3/3)
      '03/06 ANUIDADE DIFERENCI 03/12 105,00',  // future (parcela 3/12)
      '06/06 ART MINAS -CT 02/02 156,45',       // future (parcela 2/2)
      '22/06 RAIA2259 -CT 02/02 261,08',        // future (parcela 2/2)
      // --- section marker: everything above this in the trailing run is future ---
      'Limite total de crédito',
      'Total dos lançamentos atuais 447,67',
      'Total para próximas faturas 692,58',
    ].join('\n');

    it('does not count the trailing future-installment run', () => {
      const txns = itauCartaoParser.parse(STATEMENT);
      const total = txns.reduce((sum, t) => sum + t.amount, 0);
      // Current only: -169,90 -120,27 -105,00 +52,50 = -342,67
      expect(total).toBeCloseTo(-342.67, 2);
    });

    it('keeps the current installment but drops its future occurrence', () => {
      const txns = itauCartaoParser.parse(STATEMENT);
      const proquality = txns.filter(t => t.description.includes('PROQUALITY'));
      expect(proquality).toHaveLength(1);
      const anuidade = txns.filter(t => t.description.includes('ANUIDADE') && t.type === 'debit');
      expect(anuidade).toHaveLength(1);
    });

    it('keeps current non-installment charges before the future run', () => {
      const txns = itauCartaoParser.parse(STATEMENT);
      expect(txns.find(t => t.description.includes('AWS Brazil'))).toBeDefined();
      expect(txns.find(t => t.description.includes('ESTORNO'))).toBeDefined();
    });

    it('drops future-only installments that have no current counterpart', () => {
      const txns = itauCartaoParser.parse(STATEMENT);
      // ART MINAS and RAIA2259 only appear in the future run.
      expect(txns.find(t => t.description.includes('ART MINAS'))).toBeUndefined();
      expect(txns.find(t => t.description.includes('RAIA2259'))).toBeUndefined();
    });

    // Regression for the code-review HIGH finding: a statement whose genuinely
    // last charge is a mid-cycle installment (parcela >= 2) with NO future block
    // after it must NOT have that charge dropped. Reconciliation against the
    // printed "Total dos lançamentos atuais" keeps it because the books already
    // balance, so nothing is popped.
    const NO_FUTURE_BLOCK = [
      'ITAU UNIBANCO HOLDING S.A.',
      '02/06 AWS Brazil 120,27',
      '03/06 ANUIDADE DIFERENCI 02/12 105,00', // last line IS a parcela-2 current charge
      'Limite total de crédito',
      'Total dos lançamentos atuais 225,27', // 120,27 + 105,00
    ].join('\n');

    it('keeps a trailing current installment when there is no future block', () => {
      const txns = itauCartaoParser.parse(NO_FUTURE_BLOCK);
      const total = txns.reduce((sum, t) => sum + t.amount, 0);
      expect(total).toBeCloseTo(-225.27, 2);
      expect(txns.find(t => t.description.includes('ANUIDADE'))).toBeDefined();
      expect(txns).toHaveLength(2);
    });
  });
});
