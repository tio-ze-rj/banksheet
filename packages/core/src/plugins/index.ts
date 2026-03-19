import type { BankParser } from '../types';
import { bradescoCartaoParser } from './BR/bradesco-cartao/index';
import { c6CartaoParser } from './BR/c6-cartao/index';
import { interCartaoParser } from './BR/inter-cartao/index';
import { itauCartaoParser } from './BR/itau-cartao/index';
import { nubankCartaoParser } from './BR/nubank-cartao/index';
import { portoSeguroCartaoParser } from './BR/porto-seguro-cartao/index';

/** All registered bank parsers */
export const plugins: BankParser[] = [
  bradescoCartaoParser,
  c6CartaoParser,
  interCartaoParser,
  itauCartaoParser,
  nubankCartaoParser,
  portoSeguroCartaoParser,
];

export function getParserByName(name: string): BankParser | undefined {
  return plugins.find(p => p.name.toLowerCase() === name.toLowerCase());
}

export function listParsers(): Array<{ name: string; country: string }> {
  return plugins.map(p => ({ name: p.name, country: p.country }));
}
