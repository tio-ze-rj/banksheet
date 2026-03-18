#!/usr/bin/env node
import { Command } from 'commander';
import { parse } from './commands/parse';
import { list } from './commands/list';

const program = new Command();

program
  .name('banksheet')
  .description('Parse bank statement PDFs into CSV, Excel, or JSON')
  .version('0.1.0');

program
  .command('parse')
  .description('Parse one or more PDF statements')
  .argument('<files...>', 'PDF files to parse')
  .option('-f, --format <format>', 'Output format: csv, json, excel', 'csv')
  .option('-o, --output <path>', 'Output file path')
  .option('-b, --bank <name>', 'Bank name (skip auto-detection)')
  .action(async (files, options) => {
    await parse({
      files,
      format: options.format,
      output: options.output,
      bank: options.bank,
    });
  });

program
  .command('list')
  .description('List available bank parsers')
  .action(() => list());

program.parse();
