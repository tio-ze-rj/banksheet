import { describe, it, expect } from 'vitest';
import { nubankCartaoParser } from '../index';

describe('nubankCartaoParser', () => {
  describe('detect', () => {
    it('detects Nu Pagamentos S.A.', () => {
      expect(nubankCartaoParser.detect('Nu Pagamentos S.A.')).toBe(true);
    });

    it('detects Nubank CNPJ', () => {
      expect(nubankCartaoParser.detect('CNPJ 18.236.120/0001-58')).toBe(true);
    });

    it('detects nubank keyword', () => {
      expect(nubankCartaoParser.detect('conta Nubank.')).toBe(true);
    });

    it('does not detect unrelated text', () => {
      expect(nubankCartaoParser.detect('Bradesco Cartões ITAUUNIBANCO')).toBe(false);
    });
  });

  describe('parse', () => {
    const sampleText = [
      'MARCUS GABRIEL DO AMARAL DE ANTONIO',
      'FATURA 09 MAR 2026 EMISSÃO E ENVIO 02 MAR 2026',
      'TRANSAÇÕES DE 02 FEV A 02 MAR',
      'Marcus G A Antonio R$ 202,89',
      '05 FEV IOF de "Forwardemail.Net" R$ 6,86',
      '05 FEV •••• 7245 Forwardemail.Net',
      'USD 36.00',
      'Conversão: USD 1 = R$ 5,44',
      'R$ 196,03',
      'Pagamentos e Financiamentos -R$ 18,56',
      '09 FEV Pagamento em 09 FEV −R$ 18,56',
      '09 FEV Saldo restante da fatura anterior R$ 0,00',
      '09 FEV Saldo restante da fatura anterior R$ 0,00',
    ].join('\n');

    it('parses all transactions', () => {
      const txns = nubankCartaoParser.parse(sampleText);
      expect(txns).toHaveLength(3);
    });

    it('parses IOF as debit', () => {
      const txns = nubankCartaoParser.parse(sampleText);
      const iof = txns[0];
      expect(iof.date).toBe('2026-02-05');
      expect(iof.description).toBe('IOF de "Forwardemail.Net"');
      expect(iof.amount).toBe(-6.86);
      expect(iof.type).toBe('debit');
    });

    it('parses international purchase with multiline amount', () => {
      const txns = nubankCartaoParser.parse(sampleText);
      const purchase = txns[1];
      expect(purchase.date).toBe('2026-02-05');
      expect(purchase.description).toContain('Forwardemail.Net');
      expect(purchase.amount).toBe(-196.03);
      expect(purchase.type).toBe('debit');
    });

    it('parses payment as credit with positive amount', () => {
      const txns = nubankCartaoParser.parse(sampleText);
      const payment = txns[2];
      expect(payment.date).toBe('2026-02-09');
      expect(payment.description).toBe('Pagamento em 09 FEV');
      expect(payment.amount).toBe(18.56);
      expect(payment.type).toBe('credit');
    });

    it('skips zero-amount saldo restante lines', () => {
      const txns = nubankCartaoParser.parse(sampleText);
      const descriptions = txns.map(t => t.description);
      expect(descriptions.every(d => !d.includes('Saldo restante'))).toBe(true);
    });

    it('skips card holder total line', () => {
      const txns = nubankCartaoParser.parse(sampleText);
      const descriptions = txns.map(t => t.description);
      expect(descriptions).not.toContain('Marcus G A Antonio');
    });

    it('skips category header line', () => {
      const txns = nubankCartaoParser.parse(sampleText);
      const descriptions = txns.map(t => t.description);
      expect(descriptions.every(d => !d.includes('Pagamentos e Financiamentos'))).toBe(true);
    });

    it('all transactions have BRL currency', () => {
      const txns = nubankCartaoParser.parse(sampleText);
      txns.forEach(t => expect(t.currency).toBe('BRL'));
    });

    it('extracts year from FATURA header', () => {
      const txns = nubankCartaoParser.parse(sampleText);
      txns.forEach(t => expect(t.date).toMatch(/^2026-/));
    });

    it('debit amounts match expected total', () => {
      const txns = nubankCartaoParser.parse(sampleText);
      const debitSum = txns
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.amount, 0);
      expect(debitSum).toBeCloseTo(-202.89, 2);
    });

    it('returns empty array when no TRANSAÇÕES section', () => {
      const txns = nubankCartaoParser.parse('random text without transactions');
      expect(txns).toHaveLength(0);
    });

    it('handles domestic purchases on same line', () => {
      const text = [
        'FATURA 09 MAR 2026',
        'TRANSAÇÕES DE 02 FEV A 02 MAR',
        '10 FEV UBER *TRIP R$ 25,50',
        '12 FEV MERCADO LIVRE R$ 89,90',
      ].join('\n');
      const txns = nubankCartaoParser.parse(text);
      expect(txns).toHaveLength(2);
      expect(txns[0].description).toBe('UBER *TRIP');
      expect(txns[0].amount).toBe(-25.5);
      expect(txns[1].description).toBe('MERCADO LIVRE');
      expect(txns[1].amount).toBe(-89.9);
    });
  });
});
