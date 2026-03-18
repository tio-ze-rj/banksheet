import { describe, it, expect } from 'vitest';
import { interCartaoParser } from '../index';

describe('interCartaoParser', () => {
  describe('detect', () => {
    it('detects BANCO INTER S/A', () => {
      expect(interCartaoParser.detect('BANCO INTER S/A CNPJ: 00.416.968')).toBe(true);
    });

    it('detects bancointer.com.br', () => {
      expect(interCartaoParser.detect('acesse: www.bancointer.com.br')).toBe(true);
    });

    it('detects Banco Inter', () => {
      expect(interCartaoParser.detect('BENEFICIÁRIO BANCO INTER S/A')).toBe(true);
    });

    it('detects Cartão Inter', () => {
      expect(interCartaoParser.detect('Cartão Inter Loop')).toBe(true);
    });

    it('does not detect unrelated text', () => {
      expect(interCartaoParser.detect('Bradesco Cartões')).toBe(false);
    });

    it('does not detect unrelated text with "inter" substring', () => {
      expect(interCartaoParser.detect('international payment processing')).toBe(false);
    });
  });

  describe('parse', () => {
    const sampleText = [
      'Resumo da fatura',
      'R$ 1.709,92',
      'Data de Vencimento',
      '15/03/2026',
      'Despesas da fatura',
      'CARTÃO 2306****4470',
      'Data Movimentação Beneficiário Valor',
      '18 de fev. 2026 PAGTO DEBITO AUTOMATICO - + R$ 738,07',
      'Total CARTÃO 2306****4470 R$ 0,00',
      'CARTÃO 2306****0480',
      'Data Movimentação Beneficiário Valor',
      '10 de fev. 2026 PCLOUD.COM',
      'Valor e símbolo da moeda de origem: 279,00 USD',
      'Valor em dólar americano: $ 279,00',
      'Cotação do dólar americano: R$ 5,4617',
      '- R$ 1.523,81',
      '11 de fev. 2026 IOF INTERNACIONAL - R$ 53,33',
      '25 de fev. 2026 PAYPAL *INTERSERVER - R$ 48,87',
      '26 de fev. 2026 IOF INTERNACIONAL - R$ 1,71',
      '04 de mar. 2026 PAYPAL *INFATICAPTE - R$ 79,42',
      '05 de mar. 2026 IOF INTERNACIONAL - R$ 2,78',
      'Total CARTÃO 2306****0480 R$ 1.709,92',
      'Limite de crédito total:',
      'R$ 18.350,00',
    ].join('\n');

    it('parses all transactions', () => {
      const txns = interCartaoParser.parse(sampleText);
      expect(txns).toHaveLength(7);
    });

    it('parses payment as credit with positive amount', () => {
      const txns = interCartaoParser.parse(sampleText);
      const payment = txns[0];
      expect(payment.date).toBe('2026-02-18');
      expect(payment.description).toBe('PAGTO DEBITO AUTOMATICO');
      expect(payment.amount).toBe(738.07);
      expect(payment.type).toBe('credit');
    });

    it('parses international purchase with multiline amount', () => {
      const txns = interCartaoParser.parse(sampleText);
      const pcloud = txns[1];
      expect(pcloud.date).toBe('2026-02-10');
      expect(pcloud.description).toBe('PCLOUD.COM');
      expect(pcloud.amount).toBe(-1523.81);
      expect(pcloud.type).toBe('debit');
    });

    it('parses IOF as separate transaction', () => {
      const txns = interCartaoParser.parse(sampleText);
      const iof = txns[2];
      expect(iof.date).toBe('2026-02-11');
      expect(iof.description).toBe('IOF INTERNACIONAL');
      expect(iof.amount).toBe(-53.33);
      expect(iof.type).toBe('debit');
    });

    it('parses regular purchase correctly', () => {
      const txns = interCartaoParser.parse(sampleText);
      const paypal = txns[3];
      expect(paypal.date).toBe('2026-02-25');
      expect(paypal.description).toBe('PAYPAL *INTERSERVER');
      expect(paypal.amount).toBe(-48.87);
    });

    it('parses March transactions with correct month', () => {
      const txns = interCartaoParser.parse(sampleText);
      const march = txns[5];
      expect(march.date).toBe('2026-03-04');
      expect(march.description).toBe('PAYPAL *INFATICAPTE');
    });

    it('all transactions have BRL currency', () => {
      const txns = interCartaoParser.parse(sampleText);
      txns.forEach(t => expect(t.currency).toBe('BRL'));
    });

    it('debit amounts sum correctly (excluding credit)', () => {
      const txns = interCartaoParser.parse(sampleText);
      const debitSum = txns
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.amount, 0);
      expect(debitSum).toBeCloseTo(-1709.92, 2);
    });

    it('returns empty array when no Despesas section', () => {
      const txns = interCartaoParser.parse('some random text');
      expect(txns).toHaveLength(0);
    });

    it('skips card headers and totals', () => {
      const txns = interCartaoParser.parse(sampleText);
      const descriptions = txns.map(t => t.description);
      expect(descriptions).not.toContain('CARTÃO 2306****4470');
      expect(descriptions).not.toContain('Total CARTÃO 2306****0480');
    });
  });
});
