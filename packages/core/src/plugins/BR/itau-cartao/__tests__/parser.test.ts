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

// Same installment transaction repeated (simulates "próximas faturas" section)
const TEXT_WITH_FUTURE = `
ITAUUNIBANCOHOLDINGS.A.
09/02PROQUALITYP-CT U 01/03169,90
24/01LOJASRENNER-CT1802/03171,70
09/02PROQUALITYP-CT U 02/03169,90
24/01LOJASRENNER-CT1803/03171,70
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

  describe('deduplication - próximas faturas', () => {
    it('removes duplicate installment transactions', () => {
      const txns = itauCartaoParser.parse(TEXT_WITH_FUTURE);
      const proquality = txns.filter(t => t.description === 'PROQUALITYP-CT U');
      expect(proquality).toHaveLength(1);
    });

    it('removes duplicate even with different installment number', () => {
      const txns = itauCartaoParser.parse(TEXT_WITH_FUTURE);
      const renner = txns.filter(t => t.description === 'LOJASRENNER-CT');
      expect(renner).toHaveLength(1);
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
});
