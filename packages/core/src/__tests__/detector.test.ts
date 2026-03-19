import { describe, it, expect } from 'vitest';
import { detectBank } from '../detector';
import { plugins, getParserByName, listParsers } from '../plugins/index';

describe('plugin registry', () => {
  it('getParserByName finds Itaú Cartão', () => {
    expect(getParserByName('Itaú Cartão')?.name).toBe('Itaú Cartão');
  });

  it('getParserByName is case insensitive', () => {
    expect(getParserByName('itaú cartão')?.name).toBe('Itaú Cartão');
  });

  it('getParserByName returns undefined for unknown', () => {
    expect(getParserByName('Unknown')).toBeUndefined();
  });

  it('listParsers returns all registered parsers', () => {
    const list = listParsers();
    expect(list).toHaveLength(5);
    expect(list).toContainEqual({ name: 'Bradesco Cartão', country: 'BR' });
    expect(list).toContainEqual({ name: 'C6 Cartão', country: 'BR' });
    expect(list).toContainEqual({ name: 'Inter Cartão', country: 'BR' });
    expect(list).toContainEqual({ name: 'Itaú Cartão', country: 'BR' });
    expect(list).toContainEqual({ name: 'Nubank Cartão', country: 'BR' });
  });

  it('getParserByName finds Bradesco Cartão', () => {
    expect(getParserByName('Bradesco Cartão')?.name).toBe('Bradesco Cartão');
  });
});

describe('detectBank', () => {
  it('detects Itaú by VISA INFINITY text', () => {
    const result = detectBank('VISA INFINITY\n03/01COMPRA100,00', plugins);
    expect(result?.name).toBe('Itaú Cartão');
  });

  it('detects Itaú by ITAUUNIBANCO text', () => {
    const result = detectBank('ITAUUNIBANCOHOLDINGS.A.\n04/02NETFLIX.COM44,90', plugins);
    expect(result?.name).toBe('Itaú Cartão');
  });

  it('detects Itaú by BancoItaú text', () => {
    const result = detectBank('BancoItaúS.A.341-7\n04/02COMPRA100,00', plugins);
    expect(result?.name).toBe('Itaú Cartão');
  });

  it('detects Bradesco by Bradesco Cartões text', () => {
    const result = detectBank('Bradesco Cartões\nLançamentos\n05/02 COMPRA100,00', plugins);
    expect(result?.name).toBe('Bradesco Cartão');
  });

  it('detects Bradesco by Banco Bradesco S/A text', () => {
    const result = detectBank('Banco Bradesco S/A - CNPJ 60.746.948/0001-12', plugins);
    expect(result?.name).toBe('Bradesco Cartão');
  });

  it('detects Bradesco by banco.bradesco URL', () => {
    const result = detectBank('SAIBA MAIS EM NOSSO SITE BANCO.BRADESCO/MEUCARTAO', plugins);
    expect(result?.name).toBe('Bradesco Cartão');
  });

  it('detects Nubank by Nu Pagamentos S.A. text', () => {
    const result = detectBank('Nu Pagamentos S.A. CNPJ 18.236.120/0001-58', plugins);
    expect(result?.name).toBe('Nubank Cartão');
  });

  it('detects Nubank by nubank keyword', () => {
    const result = detectBank('conta Nubank para pagamento', plugins);
    expect(result?.name).toBe('Nubank Cartão');
  });

  it('detects C6 by C6 Carbon text', () => {
    const result = detectBank('Cartão C6 Carbon Final 1169', plugins);
    expect(result?.name).toBe('C6 Cartão');
  });

  it('detects C6 by C6 Bank text', () => {
    const result = detectBank('Pagando pela conta C6 Bank', plugins);
    expect(result?.name).toBe('C6 Cartão');
  });

  it('detects Inter by BANCO INTER S/A text', () => {
    const result = detectBank('BENEFICIÁRIO BANCO INTER S/A CNPJ: 00.416.968', plugins);
    expect(result?.name).toBe('Inter Cartão');
  });

  it('detects Inter by bancointer.com.br URL', () => {
    const result = detectBank('acesse: www.bancointer.com.br', plugins);
    expect(result?.name).toBe('Inter Cartão');
  });

  it('returns undefined for unknown text', () => {
    const result = detectBank('random text here', plugins);
    expect(result).toBeUndefined();
  });
});
