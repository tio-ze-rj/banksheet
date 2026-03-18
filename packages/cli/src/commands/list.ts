import { listParsers } from '@banksheet/core';

export function list(): void {
  const parsers = listParsers();
  console.log('Available bank parsers:\n');
  for (const p of parsers) {
    console.log(`  ${p.name} (${p.country})`);
  }
  console.log(`\nTotal: ${parsers.length} parser(s)`);
}
