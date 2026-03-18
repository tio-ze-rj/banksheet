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
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ name: 'Itaú Cartão', country: 'BR' });
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

  it('returns undefined for unknown text', () => {
    const result = detectBank('random text here', plugins);
    expect(result).toBeUndefined();
  });
});
