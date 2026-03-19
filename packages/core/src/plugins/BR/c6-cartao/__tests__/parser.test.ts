import { describe, it, expect } from 'vitest';
import { c6CartaoParser } from '../index';

describe('c6CartaoParser', () => {
  describe('detect', () => {
    it('detects C6 Bank', () => {
      expect(c6CartaoParser.detect('Pagando pela conta C6 Bank')).toBe(true);
    });

    it('detects C6 Carbon', () => {
      expect(c6CartaoParser.detect('Cartão C6 Carbon')).toBe(true);
    });

    it('detects Banco C6 S.A.', () => {
      expect(c6CartaoParser.detect('Banco C6 S.A. CNPJ: 31.872.495/0001-72')).toBe(true);
    });

    it('detects by CNPJ', () => {
      expect(c6CartaoParser.detect('CNPJ 31.872.495/0001-72')).toBe(true);
    });

    it('does not detect unrelated text', () => {
      expect(c6CartaoParser.detect('Bradesco Cartões')).toBe(false);
    });
  });

  describe('parse', () => {
    const sampleText = [
      'Olá, João! Sua fatura com vencimento em Março chegou.',
      'Vencimento: 01 de Março',
      'Valor da fatura: R$ 2.500,00',
      'Compras e pagamentos feitos até o fechamento desta fatura em 20/02/26.',
      'Compras nacionais 2.500,00',
      '--- PAGE BREAK ---',
      'Transações do cartão principal',
      'C6 Carbon Final 1169 - JOAO DA SILVA Subtotal deste cartão R$ 1.500,00',
      'Valores em reais',
      '23 jan PADARIA CENTRAL 17,97',
      '24 jan POSTO GASOLINA 200,00',
      '02 fev Inclusao de Pagamento 1.500,00',
      '05 fev SUPERMERCADO XYZ 350,50',
      '18 fev Anuidade Diferenciada - Parcela 5/12 98,00',
      '18 fev Estorno Tarifa - Estorno 98,00',
      '--- PAGE BREAK ---',
      'Transações dos cartões adicionais',
      'C6 Carbon Final 7073 - MARIA DA SILVA Subtotal deste cartão R$ 500,00',
      'Valores em reais',
      '29 jan FARMACIA ABC 29,00',
      '03 fev MERCEARIA 77,19',
      '--- PAGE BREAK ---',
      'C6 Carbon Virtual Final 4812 - JOAO DA SILVA Subtotal deste cartão R$ 800,00',
      'Cartão Virtual',
      'Valores em reais',
      '12 nov MERCADOLIVRE*LOJA - Parcela 4/6 34,71',
      '13 dez SHOPEE *TECNOLOGIA - Parcela 3/10 140,72',
      '27 jan AMAZON MARKETPLACE 37,40',
      '09 dez JIM.COM* PIERRE - Estorno 664,00',
      '09 dez JIM.COM* PIERRE - Parcela 3/3 664,00',
      'Formas de pagamento',
      'Banco C6 SA',
    ].join('\n');

    it('parses all transactions', () => {
      const txns = c6CartaoParser.parse(sampleText);
      expect(txns).toHaveLength(13);
    });

    it('parses regular debit with correct date', () => {
      const txns = c6CartaoParser.parse(sampleText);
      const padaria = txns[0];
      expect(padaria.date).toBe('2026-01-23');
      expect(padaria.description).toBe('PADARIA CENTRAL');
      expect(padaria.amount).toBe(-17.97);
      expect(padaria.type).toBe('debit');
    });

    it('parses Inclusao de Pagamento as credit', () => {
      const txns = c6CartaoParser.parse(sampleText);
      const payment = txns.find(t => t.description === 'Inclusao de Pagamento');
      expect(payment).toBeDefined();
      expect(payment!.amount).toBe(1500.00);
      expect(payment!.type).toBe('credit');
    });

    it('parses Estorno as credit', () => {
      const txns = c6CartaoParser.parse(sampleText);
      const estorno = txns.find(t => t.description === 'Estorno Tarifa - Estorno');
      expect(estorno).toBeDefined();
      expect(estorno!.amount).toBe(98.00);
      expect(estorno!.type).toBe('credit');
    });

    it('parses JIM.COM Estorno as credit', () => {
      const txns = c6CartaoParser.parse(sampleText);
      const estorno = txns.find(t => t.description === 'JIM.COM* PIERRE - Estorno');
      expect(estorno).toBeDefined();
      expect(estorno!.amount).toBe(664.00);
      expect(estorno!.type).toBe('credit');
    });

    it('parses anuidade as debit', () => {
      const txns = c6CartaoParser.parse(sampleText);
      const anuidade = txns.find(t => /Anuidade/.test(t.description));
      expect(anuidade).toBeDefined();
      expect(anuidade!.amount).toBe(-98.00);
      expect(anuidade!.type).toBe('debit');
    });

    it('assigns previous year for months after closing month', () => {
      const txns = c6CartaoParser.parse(sampleText);
      const nov = txns.find(t => t.description.includes('MERCADOLIVRE'));
      expect(nov).toBeDefined();
      expect(nov!.date).toBe('2025-11-12');
    });

    it('assigns previous year to December transactions', () => {
      const txns = c6CartaoParser.parse(sampleText);
      const dez = txns.find(t => t.description === 'SHOPEE *TECNOLOGIA - Parcela 3/10');
      expect(dez).toBeDefined();
      expect(dez!.date).toBe('2025-12-13');
    });

    it('parses additional card transactions', () => {
      const txns = c6CartaoParser.parse(sampleText);
      const farmacia = txns.find(t => t.description === 'FARMACIA ABC');
      expect(farmacia).toBeDefined();
      expect(farmacia!.date).toBe('2026-01-29');
      expect(farmacia!.amount).toBe(-29.00);
    });

    it('preserves installment info in description', () => {
      const txns = c6CartaoParser.parse(sampleText);
      const parcela = txns.find(t => t.description.includes('Parcela 4/6'));
      expect(parcela).toBeDefined();
      expect(parcela!.description).toBe('MERCADOLIVRE*LOJA - Parcela 4/6');
    });

    it('all transactions have BRL currency', () => {
      const txns = c6CartaoParser.parse(sampleText);
      txns.forEach(t => expect(t.currency).toBe('BRL'));
    });

    it('returns empty array for unrelated text', () => {
      const txns = c6CartaoParser.parse('some random text without transactions');
      expect(txns).toHaveLength(0);
    });

    it('skips page headers and card subtotal lines', () => {
      const txns = c6CartaoParser.parse(sampleText);
      const descriptions = txns.map(t => t.description);
      expect(descriptions).not.toContain('C6 Carbon Final 1169');
      expect(descriptions).not.toContain('Valores em reais');
    });
  });
});
