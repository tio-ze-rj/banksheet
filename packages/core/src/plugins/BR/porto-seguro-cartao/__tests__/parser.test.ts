import { describe, it, expect } from 'vitest';
import { portoSeguroCartaoParser } from '../index';

describe('portoSeguroCartaoParser', () => {
  describe('detect', () => {
    it('detects Porto Bank', () => {
      expect(portoSeguroCartaoParser.detect('Porto Bank cartão de crédito')).toBe(true);
    });

    it('detects PortoBank (no space)', () => {
      expect(portoSeguroCartaoParser.detect('PortoBank')).toBe(true);
    });

    it('detects PORTOSEG S/A', () => {
      expect(portoSeguroCartaoParser.detect('PORTOSEG SA CRED FIN INV')).toBe(true);
    });

    it('detects PORTOSEG S.A.', () => {
      expect(portoSeguroCartaoParser.detect('PORTOSEG S/A - CNPJ 04.862.600')).toBe(true);
    });

    it('detects cartaoportoseguro URL', () => {
      expect(portoSeguroCartaoParser.detect('www.cartaoportoseguro.com.br')).toBe(true);
    });

    it('detects CNPJ', () => {
      expect(portoSeguroCartaoParser.detect('CNPJ 04.862.600/0001-10')).toBe(true);
    });

    it('does not detect unrelated text', () => {
      expect(portoSeguroCartaoParser.detect('Nubank Pagamentos')).toBe(false);
    });
  });

  describe('parse', () => {
    const sampleText = [
      'Claudio Silva',
      'Cartão 5365 37** **** *146',
      'Esta fatura vence em',
      '01/03/2026',
      'O valor total é',
      'R$ 2.500,00',
      '--- PAGE BREAK ---',
      'Detalhamento',
      'da fatura',
      'Lançamentos: compras e saques',
      'Claudio Silva (final *146)',
      'Data Estabelecimento Valor em R$',
      '21/07 CAPS GUARUJA 08/09 BZ 698,89',
      '27/08 PORTO SEGURO AUTO PA/06 BZ 152,58',
      '20/01 Newell Brands Brasi 02/10 Sao Paul 116,91',
      '26/01 BONANCA ALIMENTOS LTD SAO PAULO BR 36,00',
      '02/02 PAGAMENTO -11.642,00',
      '08/02 AMAZONMKTPLC SHOPPERIM SAO PAULO B 607,99',
      '23/02 CARTAO PROTEGIDO 14,90',
      'Lançamentos no cartão (final *146) 8.761,92',
      'Contestações poderão ser feitas em até 60 dias.',
    ].join('\n');

    it('parses all transactions', () => {
      const txns = portoSeguroCartaoParser.parse(sampleText);
      expect(txns).toHaveLength(7);
    });

    it('assigns previous year for months after due date month', () => {
      const txns = portoSeguroCartaoParser.parse(sampleText);
      // Due date is 03/2026. July (07) > March (03) → 2025
      expect(txns[0].date).toBe('2025-07-21');
      expect(txns[0].description).toBe('CAPS GUARUJA 08/09 BZ');
      expect(txns[0].amount).toBe(-698.89);
    });

    it('assigns previous year for August', () => {
      const txns = portoSeguroCartaoParser.parse(sampleText);
      expect(txns[1].date).toBe('2025-08-27');
    });

    it('assigns current year for months <= due date month', () => {
      const txns = portoSeguroCartaoParser.parse(sampleText);
      // January (01) <= March (03) → 2026
      expect(txns[2].date).toBe('2026-01-20');
      expect(txns[3].date).toBe('2026-01-26');
    });

    it('parses payment as credit with positive amount', () => {
      const txns = portoSeguroCartaoParser.parse(sampleText);
      const payment = txns[4];
      expect(payment.date).toBe('2026-02-02');
      expect(payment.description).toBe('PAGAMENTO');
      expect(payment.amount).toBe(11642);
      expect(payment.type).toBe('credit');
    });

    it('parses regular purchase as debit with negative amount', () => {
      const txns = portoSeguroCartaoParser.parse(sampleText);
      const purchase = txns[5];
      expect(purchase.date).toBe('2026-02-08');
      expect(purchase.description).toBe('AMAZONMKTPLC SHOPPERIM SAO PAULO B');
      expect(purchase.amount).toBe(-607.99);
      expect(purchase.type).toBe('debit');
    });

    it('parses card insurance as debit', () => {
      const txns = portoSeguroCartaoParser.parse(sampleText);
      const insurance = txns[6];
      expect(insurance.date).toBe('2026-02-23');
      expect(insurance.description).toBe('CARTAO PROTEGIDO');
      expect(insurance.amount).toBe(-14.9);
      expect(insurance.type).toBe('debit');
    });

    it('all transactions have BRL currency', () => {
      const txns = portoSeguroCartaoParser.parse(sampleText);
      txns.forEach(t => expect(t.currency).toBe('BRL'));
    });

    it('stops at total line', () => {
      const txns = portoSeguroCartaoParser.parse(sampleText);
      const descriptions = txns.map(t => t.description);
      expect(descriptions).not.toContain(expect.stringContaining('Lançamentos no cartão'));
    });

    it('returns empty array when no transaction section', () => {
      expect(portoSeguroCartaoParser.parse('some random text')).toHaveLength(0);
    });

    it('handles page breaks within transaction section', () => {
      const textWithBreak = [
        'Esta fatura vence em',
        '01/03/2026',
        'Data Estabelecimento Valor em R$',
        '26/01 LOJA ABC 100,00',
        '--- PAGE BREAK ---',
        '27/01 LOJA DEF 200,00',
        'Lançamentos no cartão (final *146) 300,00',
      ].join('\n');

      const txns = portoSeguroCartaoParser.parse(textWithBreak);
      expect(txns).toHaveLength(2);
      expect(txns[0].description).toBe('LOJA ABC');
      expect(txns[1].description).toBe('LOJA DEF');
    });

    it('preserves installment info in description', () => {
      const txns = portoSeguroCartaoParser.parse(sampleText);
      expect(txns[0].description).toContain('08/09');
      expect(txns[2].description).toContain('02/10');
    });

    it('preserves raw line', () => {
      const txns = portoSeguroCartaoParser.parse(sampleText);
      expect(txns[0].raw).toBe('21/07 CAPS GUARUJA 08/09 BZ 698,89');
    });
  });
});
