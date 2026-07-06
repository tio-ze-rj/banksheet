import { describe, it, expect } from 'vitest';
import { bradescoCartaoParser } from '../index';

describe('bradescoCartaoParser', () => {
  describe('detect', () => {
    it('detects Bradesco Cartões', () => {
      expect(bradescoCartaoParser.detect('Bradesco Cartões')).toBe(true);
    });

    it('detects Banco Bradesco S/A', () => {
      expect(bradescoCartaoParser.detect('Banco Bradesco S/A - CNPJ 60.746.948/0001-12')).toBe(true);
    });

    it('detects banco.bradesco URL', () => {
      expect(bradescoCartaoParser.detect('BANCO.BRADESCO/MEUCARTAO')).toBe(true);
    });

    it('does not detect unrelated text', () => {
      expect(bradescoCartaoParser.detect('ITAUUNIBANCO VISA INFINITY')).toBe(false);
    });
  });

  describe('parse', () => {
    const year = new Date().getFullYear();

    const sampleText = [
      'Fatura Mensal',
      'Número do Cartão3764 XXXXXX 06946',
      'Lançamentos',
      'DataHistórico de LançamentosCidadeUS$',
      'Cotação',
      'do Dólar',
      'R$',
      '05/02  PAGTO ANTECIPADO PIX1.724,12-',
      'FULANO DE TAL',
      'Cartão 3764 XXXXXX 06946',
      '25/01 PPRO*LINKEDINSAO PAULO89,99',
      '01/02 AmazonPrimeBRSAO PAULO19,90',
      'Total paraFULANO DE TAL109,89',
      'CICLANA DE TAL',
      'Cartão 3764 XXXXXX 64947',
      '03/01 CASA CARIOCA        02/02RESENDE1.141,12',
      '01/02 PASQUALINE PIZZA&PASTARESENDE155,87',
      'Total paraCICLANA DE TAL1.296,99',
      'Total da fatura em real1.406,88',
    ].join('\n');

    it('parses all transactions', () => {
      const txns = bradescoCartaoParser.parse(sampleText);
      expect(txns).toHaveLength(5);
    });

    it('parses payment as credit with positive amount', () => {
      const txns = bradescoCartaoParser.parse(sampleText);
      const payment = txns[0];
      expect(payment.date).toBe(`${year}-02-05`);
      expect(payment.description).toBe('PAGTO ANTECIPADO PIX');
      expect(payment.amount).toBe(1724.12);
      expect(payment.type).toBe('credit');
    });

    it('parses regular purchase as debit with negative amount', () => {
      const txns = bradescoCartaoParser.parse(sampleText);
      const linkedin = txns[1];
      expect(linkedin.date).toBe(`${year}-01-25`);
      expect(linkedin.description).toBe('PPRO*LINKEDIN');
      expect(linkedin.amount).toBe(-89.99);
      expect(linkedin.type).toBe('debit');
    });

    it('strips known city names from descriptions', () => {
      const txns = bradescoCartaoParser.parse(sampleText);
      expect(txns[1].description).toBe('PPRO*LINKEDIN');
      expect(txns[2].description).toBe('AmazonPrimeBR');
      expect(txns[4].description).toBe('PASQUALINE PIZZA&PASTA');
    });

    it('preserves installment info in description', () => {
      const txns = bradescoCartaoParser.parse(sampleText);
      const casa = txns[3];
      expect(casa.description).toBe('CASA CARIOCA 02/02');
      expect(casa.amount).toBe(-1141.12);
    });

    it('skips card holder names and subtotals', () => {
      const txns = bradescoCartaoParser.parse(sampleText);
      const descriptions = txns.map(t => t.description);
      expect(descriptions).not.toContain('FULANO DE TAL');
      expect(descriptions).not.toContain('CICLANA DE TAL');
    });

    it('debit amounts sum to invoice total', () => {
      const txns = bradescoCartaoParser.parse(sampleText);
      const debitSum = txns
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.amount, 0);
      expect(debitSum).toBeCloseTo(-1406.88, 2);
    });

    it('all transactions have BRL currency', () => {
      const txns = bradescoCartaoParser.parse(sampleText);
      txns.forEach(t => expect(t.currency).toBe('BRL'));
    });

    it('returns empty array when no Lançamentos section', () => {
      const txns = bradescoCartaoParser.parse('some random text');
      expect(txns).toHaveLength(0);
    });
  });

  // Real statement layout: pdfjs extracts space-separated columns and wraps
  // long descriptions / trailing city across multiple lines, with the amount
  // sometimes landing on its own line. Two card holders. Regression for the
  // "calculates wrong with 2 card holders" bug.
  describe('parse — wrapped multi-line layout (real statement)', () => {
    const year = new Date().getFullYear();

    const wrappedText = [
      'Fatura Mensal',
      'Número do Cartão 0000 XXXXXX 00001',
      'Lançamentos',
      'Data Histórico de Lançamentos Cidade US$ Cotação',
      'do Dólar R$',
      '08/06 PAG BOLETO BANCARIO 0,80 -',
      'FULANO DE TAL SILVA Cartão 0000 XXXXXX 00001',
      '27/05 LOJA EXEMPLO LTDA 01/12 VOLTA',
      'REDONDA',
      '324,24',
      'Total para FULANO DE TAL',
      'SILVA 324,24',
      'CICLANA DE TAL SOUZA Cartão 0000 XXXXXX 00002',
      '25/05 CLINICA EXEMPLO 01/03 SAO PAULO 783,34',
      'Total para CICLANA DE TAL',
      'SOUZA 783,34',
      'Total da fatura em real 1.107,58',
    ].join('\n');

    it('parses all 3 transactions across both card holders', () => {
      const txns = bradescoCartaoParser.parse(wrappedText);
      expect(txns).toHaveLength(3);
    });

    it('parses the payment (amount with space before trailing dash) as credit', () => {
      const txns = bradescoCartaoParser.parse(wrappedText);
      const payment = txns[0];
      expect(payment.date).toBe(`${year}-06-08`);
      expect(payment.description).toBe('PAG BOLETO BANCARIO');
      expect(payment.amount).toBe(0.8);
      expect(payment.type).toBe('credit');
    });

    it('parses a transaction whose amount wrapped onto its own line', () => {
      const txns = bradescoCartaoParser.parse(wrappedText);
      const wrapped = txns[1];
      expect(wrapped.date).toBe(`${year}-05-27`);
      expect(wrapped.description).toBe('LOJA EXEMPLO LTDA 01/12');
      expect(wrapped.amount).toBe(-324.24);
      expect(wrapped.type).toBe('debit');
    });

    it('parses the single-line transaction for the second holder', () => {
      const txns = bradescoCartaoParser.parse(wrappedText);
      const single = txns[2];
      expect(single.date).toBe(`${year}-05-25`);
      expect(single.description).toBe('CLINICA EXEMPLO 01/03');
      expect(single.amount).toBe(-783.34);
      expect(single.type).toBe('debit');
    });

    it('debit total matches the invoice total (1.107,58)', () => {
      const txns = bradescoCartaoParser.parse(wrappedText);
      const debitSum = txns
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.amount, 0);
      expect(debitSum).toBeCloseTo(-1107.58, 2);
    });

    it('does not treat "Total para" subtotals as transactions', () => {
      const txns = bradescoCartaoParser.parse(wrappedText);
      const descriptions = txns.map(t => t.description);
      expect(descriptions.some(d => /Total para/i.test(d))).toBe(false);
    });
  });
});
