import type { BankParser } from '../types';
import { bradescoCartaoParser } from './BR/bradesco-cartao/index';
import { itauCartaoParser } from './BR/itau-cartao/index';

/** All registered bank parsers */
export const plugins: BankParser[] = [
  bradescoCartaoParser,
  itauCartaoParser,
];

export function getParserByName(name: string): BankParser | undefined {
  return plugins.find(p => p.name.toLowerCase() === name.toLowerCase());
}

export function listParsers(): Array<{ name: string; country: string }> {
  return plugins.map(p => ({ name: p.name, country: p.country }));
}
