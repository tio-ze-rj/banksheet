import fs from 'node:fs';
import path from 'node:path';
import {
  extractText,
  parseStatement,
  plugins,
  exportCSV,
  exportJSON,
  exportExcel,
} from '@banksheet/core';
import type { ExportOptions } from '@banksheet/core';

export interface ParseArgs {
  files: string[];
  format: ExportOptions['format'];
  output?: string;
  bank?: string;
}

export async function parse(args: ParseArgs): Promise<void> {
  const allTransactions = [];

  for (const file of args.files) {
    const filePath = path.resolve(file);
    const buffer = fs.readFileSync(filePath);
    const text = await extractText(buffer);
    const result = parseStatement(text, plugins, args.bank);

    console.error(`[${result.bank}] ${file}: ${result.transactions.length} transactions`);
    allTransactions.push(...result.transactions);
  }

  if (allTransactions.length === 0) {
    console.error('No transactions found.');
    process.exit(1);
  }

  let output: string | Buffer;

  switch (args.format) {
    case 'json':
      output = exportJSON(allTransactions);
      break;
    case 'excel':
      output = await exportExcel(allTransactions);
      break;
    case 'csv':
    default:
      output = exportCSV(allTransactions);
      break;
  }

  if (args.output) {
    const outPath = path.resolve(args.output);
    fs.writeFileSync(outPath, output);
    console.error(`Written to ${outPath}`);
  } else if (Buffer.isBuffer(output)) {
    console.error('Excel format requires --output (-o) flag.');
    process.exit(1);
  } else {
    process.stdout.write(output);
  }
}
