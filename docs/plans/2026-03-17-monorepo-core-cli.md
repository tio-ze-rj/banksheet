# Monorepo Setup + Core Engine + CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure banksheet as an npm workspaces monorepo with `@banksheet/core` and `@banksheet/cli` packages, port the Visa Infinity parser from reference code, and deliver a working CLI that parses PDF statements into CSV/Excel/JSON.

**Architecture:** Monorepo with npm workspaces. `packages/core` is a pure library (no I/O opinions) that exposes parsing, detection, and export. `packages/cli` consumes core and provides the terminal interface. `packages/web` is a placeholder for phase 2. Plugins live inside core for now.

**Tech Stack:** TypeScript, Node.js, npm workspaces, pdf-parse, exceljs, commander, vitest

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.json` (root)
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/web/package.json` (placeholder)
- Create: `.gitignore`

**Step 1: Create root package.json with workspaces**

```json
{
  "name": "banksheet",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "dev": "npm run dev --workspace=packages/cli"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Step 2: Create root tsconfig.json (base config)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

**Step 3: Create packages/core/package.json**

```json
{
  "name": "@banksheet/core",
  "version": "0.1.0",
  "description": "Bank statement parsing engine",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "exceljs": "^4.4.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.0.0"
  },
  "license": "MIT"
}
```

**Step 4: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 5: Create packages/cli/package.json**

```json
{
  "name": "@banksheet/cli",
  "version": "0.1.0",
  "description": "Bank statement CLI tool",
  "bin": {
    "banksheet": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@banksheet/core": "0.1.0",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.0.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.0.0"
  },
  "license": "MIT"
}
```

**Step 6: Create packages/cli/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 7: Create packages/web/package.json (placeholder)**

```json
{
  "name": "@banksheet/web",
  "version": "0.1.0",
  "description": "Bank statement web UI (phase 2)",
  "private": true,
  "scripts": {},
  "license": "MIT"
}
```

**Step 8: Create .gitignore**

```
node_modules/
dist/
*.tgz
.DS_Store
.env
```

**Step 9: Run npm install**

Run: `npm install` from project root
Expected: workspaces linked, node_modules created

**Step 10: Commit**

```bash
git add package.json tsconfig.json packages/ .gitignore
git commit -m "chore: scaffold monorepo with npm workspaces"
```

---

## Task 2: Core Types

**Files:**
- Create: `packages/core/src/types.ts`

**Step 1: Write the types file**

```typescript
/** Single parsed transaction from a bank statement */
export interface Transaction {
  date: string;            // ISO 8601: YYYY-MM-DD
  description: string;
  amount: number;          // Positive = income, negative = expense
  currency: string;        // ISO 4217: USD, BRL, EUR
  type: 'credit' | 'debit';
  category?: string;
  raw?: string;            // Original line from PDF (debugging)
}

/** Plugin interface — one per bank */
export interface BankParser {
  name: string;            // "Visa Infinity", "Nubank", "Chase"
  country: string;         // ISO 3166-1 alpha-2: BR, US, GB
  detect(text: string): boolean;
  parse(text: string): Transaction[];
}

/** Export configuration */
export interface ExportOptions {
  format: 'csv' | 'excel' | 'json';
  output?: string;
  currency?: string;
  dateFormat?: string;
}

/** Result of parsing a statement */
export interface ParseResult {
  bank: string;
  transactions: Transaction[];
  total: number;
  currency: string;
}
```

**Step 2: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat(core): add Transaction, BankParser, ExportOptions types"
```

---

## Task 3: Visa Infinity Plugin (ported from reference)

**Files:**
- Create: `packages/core/src/plugins/visa-infinity/index.ts`
- Create: `packages/core/src/plugins/visa-infinity/__tests__/parser.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { visaInfinityParser } from '../index';

const SAMPLE_TEXT = `
VISA INFINITY
Cartão final 1234
03/01 SUPERMERCADO EXTRA      150,00
03/02 UBER *TRIP              25,50
03/03 AMAZON PRIME            -19,90
03/05 NETFLIX                  55,90
`;

const UNRELATED_TEXT = `
NUBANK
Fatura de março
Compra no débito
`;

describe('Visa Infinity Parser', () => {
  it('detects Visa Infinity statements', () => {
    expect(visaInfinityParser.detect(SAMPLE_TEXT)).toBe(true);
  });

  it('does not detect unrelated statements', () => {
    expect(visaInfinityParser.detect(UNRELATED_TEXT)).toBe(false);
  });

  it('parses transactions from text', () => {
    const transactions = visaInfinityParser.parse(SAMPLE_TEXT);
    expect(transactions).toHaveLength(4);
  });

  it('extracts date as ISO 8601', () => {
    const transactions = visaInfinityParser.parse(SAMPLE_TEXT);
    expect(transactions[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(transactions[0].date).toContain('-01-03');
  });

  it('extracts description trimmed', () => {
    const transactions = visaInfinityParser.parse(SAMPLE_TEXT);
    expect(transactions[0].description).toBe('SUPERMERCADO EXTRA');
  });

  it('parses positive amounts as negative (expense)', () => {
    const transactions = visaInfinityParser.parse(SAMPLE_TEXT);
    expect(transactions[0].amount).toBe(-150.00);
    expect(transactions[0].type).toBe('debit');
  });

  it('parses negative amounts as positive (credit/refund)', () => {
    const transactions = visaInfinityParser.parse(SAMPLE_TEXT);
    const refund = transactions.find(t => t.description === 'AMAZON PRIME');
    expect(refund).toBeDefined();
    expect(refund!.amount).toBe(19.90);
    expect(refund!.type).toBe('credit');
  });

  it('sets currency to BRL', () => {
    const transactions = visaInfinityParser.parse(SAMPLE_TEXT);
    expect(transactions[0].currency).toBe('BRL');
  });

  it('preserves raw line', () => {
    const transactions = visaInfinityParser.parse(SAMPLE_TEXT);
    expect(transactions[0].raw).toContain('SUPERMERCADO EXTRA');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/plugins/visa-infinity/__tests__/parser.test.ts`
Expected: FAIL — module not found

**Step 3: Write the parser (ported from reference limparTexto)**

```typescript
import type { BankParser, Transaction } from '../../types';

export const visaInfinityParser: BankParser = {
  name: 'Visa Infinity',
  country: 'BR',

  detect(text: string): boolean {
    return /VISA\s+INFINITY/i.test(text);
  },

  parse(text: string): Transaction[] {
    const dateRegex = /^\d{2}\/\d{2}(?!\/)/;
    const currentYear = new Date().getFullYear();

    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => dateRegex.test(line) && line.length > 5);

    return lines.map(line => {
      // Find last letter to split description from amount
      let lastLetterIdx = -1;
      for (let i = line.length - 1; i >= 0; i--) {
        if (/[A-Za-z]/.test(line[i])) {
          lastLetterIdx = i;
          break;
        }
      }

      const descriptionPart = line.substring(0, lastLetterIdx + 1).trim();
      let rawAmount = line.substring(lastLetterIdx + 1).trim();

      // Check for negative sign (refund/credit)
      const isNegative = /^\s*-/.test(rawAmount) || /-\s*$/.test(rawAmount);

      // Clean amount: remove non-numeric except comma/dot/dash
      rawAmount = rawAmount.replace(/[^\d,.-]/g, '');
      // Remove dash, convert BR format (1.234,56) to number
      rawAmount = rawAmount.replace(/-/g, '').replace('.', '').replace(',', '.');
      const numericAmount = parseFloat(rawAmount);

      // Credit card: positive in statement = expense (negative amount)
      // Negative in statement = refund/credit (positive amount)
      const amount = isNegative ? numericAmount : -numericAmount;
      const type = isNegative ? 'credit' : 'debit';

      // Parse date: DD/MM -> YYYY-MM-DD
      const [day, month] = line.substring(0, 5).split('/');
      const date = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      // Description: everything after date prefix (5 chars) up to amount
      const description = descriptionPart.substring(5).trim();

      return {
        date,
        description,
        amount,
        currency: 'BRL',
        type,
        raw: line,
      } satisfies Transaction;
    });
  },
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/plugins/visa-infinity/__tests__/parser.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/core/src/plugins/visa-infinity/
git commit -m "feat(core): add Visa Infinity parser plugin ported from reference"
```

---

## Task 4: PDF Extractor + Parser Orchestrator

**Files:**
- Create: `packages/core/src/parser.ts`
- Create: `packages/core/src/__tests__/parser.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractText, parseStatement } from '../parser';
import type { BankParser, Transaction } from '../types';

const mockParser: BankParser = {
  name: 'Mock Bank',
  country: 'US',
  detect: (text) => text.includes('MOCK_BANK'),
  parse: (text) => [{
    date: '2026-01-01',
    description: 'Test',
    amount: -10,
    currency: 'USD',
    type: 'debit',
  }],
};

describe('parseStatement', () => {
  it('selects correct parser and returns transactions', () => {
    const result = parseStatement('MOCK_BANK\nsome data', [mockParser]);
    expect(result.bank).toBe('Mock Bank');
    expect(result.transactions).toHaveLength(1);
  });

  it('throws when no parser detects the text', () => {
    expect(() => parseStatement('unknown text', [mockParser]))
      .toThrow('No parser detected');
  });

  it('uses explicit parser when specified', () => {
    const result = parseStatement('any text', [mockParser], 'Mock Bank');
    expect(result.bank).toBe('Mock Bank');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/__tests__/parser.test.ts`
Expected: FAIL

**Step 3: Write parser.ts**

```typescript
import pdfParse from 'pdf-parse';
import type { BankParser, ParseResult } from './types';

/** Extract raw text from a PDF buffer */
export async function extractText(pdfBuffer: Buffer): Promise<string> {
  const result = await pdfParse(pdfBuffer);
  return result.text;
}

/** Parse statement text using available plugins */
export function parseStatement(
  text: string,
  parsers: BankParser[],
  bankName?: string,
): ParseResult {
  let parser: BankParser | undefined;

  if (bankName) {
    parser = parsers.find(
      p => p.name.toLowerCase() === bankName.toLowerCase(),
    );
    if (!parser) {
      throw new Error(`Parser not found: ${bankName}`);
    }
  } else {
    parser = parsers.find(p => p.detect(text));
    if (!parser) {
      throw new Error(
        'No parser detected for this statement. Use --bank to specify manually.',
      );
    }
  }

  const transactions = parser.parse(text);
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  const currency = transactions[0]?.currency ?? 'USD';

  return {
    bank: parser.name,
    transactions,
    total,
    currency,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/__tests__/parser.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/core/src/parser.ts packages/core/src/__tests__/
git commit -m "feat(core): add PDF text extractor and parser orchestrator"
```

---

## Task 5: Plugin Registry + Auto-Detection

**Files:**
- Create: `packages/core/src/plugins/index.ts`
- Create: `packages/core/src/detector.ts`
- Create: `packages/core/src/__tests__/detector.test.ts`

**Step 1: Write plugin registry**

```typescript
import type { BankParser } from '../types';
import { visaInfinityParser } from './visa-infinity/index';

/** All registered bank parsers */
export const plugins: BankParser[] = [
  visaInfinityParser,
];

export function getParserByName(name: string): BankParser | undefined {
  return plugins.find(p => p.name.toLowerCase() === name.toLowerCase());
}

export function listParsers(): Array<{ name: string; country: string }> {
  return plugins.map(p => ({ name: p.name, country: p.country }));
}
```

**Step 2: Write the failing test for detector**

```typescript
import { describe, it, expect } from 'vitest';
import { detectBank } from '../detector';
import { plugins } from '../plugins/index';

describe('detectBank', () => {
  it('detects Visa Infinity', () => {
    const result = detectBank('VISA INFINITY\n03/01 COMPRA 100,00', plugins);
    expect(result?.name).toBe('Visa Infinity');
  });

  it('returns undefined for unknown text', () => {
    const result = detectBank('random text here', plugins);
    expect(result).toBeUndefined();
  });
});
```

**Step 3: Write detector.ts**

```typescript
import type { BankParser } from './types';

/** Auto-detect which bank parser matches the statement text */
export function detectBank(
  text: string,
  parsers: BankParser[],
): BankParser | undefined {
  return parsers.find(p => p.detect(text));
}
```

**Step 4: Run tests**

Run: `npx vitest run packages/core/src/__tests__/detector.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/core/src/plugins/index.ts packages/core/src/detector.ts packages/core/src/__tests__/detector.test.ts
git commit -m "feat(core): add plugin registry and bank auto-detection"
```

---

## Task 6: Exporters (CSV, JSON, Excel)

**Files:**
- Create: `packages/core/src/exporter.ts`
- Create: `packages/core/src/__tests__/exporter.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { exportCSV, exportJSON, exportExcel } from '../exporter';
import type { Transaction } from '../types';

const transactions: Transaction[] = [
  { date: '2026-01-03', description: 'SUPERMERCADO', amount: -150, currency: 'BRL', type: 'debit' },
  { date: '2026-01-04', description: 'REFUND', amount: 19.90, currency: 'BRL', type: 'credit' },
];

describe('exportCSV', () => {
  it('returns CSV string with headers', () => {
    const csv = exportCSV(transactions);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('date,description,amount,currency,type');
    expect(lines[1]).toContain('2026-01-03');
    expect(lines[1]).toContain('SUPERMERCADO');
    expect(lines[1]).toContain('-150');
  });

  it('escapes descriptions with commas', () => {
    const tx: Transaction[] = [{
      date: '2026-01-01', description: 'FOO, BAR', amount: -10, currency: 'BRL', type: 'debit',
    }];
    const csv = exportCSV(tx);
    expect(csv).toContain('"FOO, BAR"');
  });
});

describe('exportJSON', () => {
  it('returns valid JSON array', () => {
    const json = exportJSON(transactions);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].date).toBe('2026-01-03');
  });
});

describe('exportExcel', () => {
  it('returns a Buffer', async () => {
    const buffer = await exportExcel(transactions);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/__tests__/exporter.test.ts`
Expected: FAIL

**Step 3: Write exporter.ts**

```typescript
import ExcelJS from 'exceljs';
import type { Transaction } from './types';

const CSV_HEADERS = ['date', 'description', 'amount', 'currency', 'type'] as const;

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCSV(transactions: Transaction[]): string {
  const header = CSV_HEADERS.join(',');
  const rows = transactions.map(t =>
    [t.date, escapeCSV(t.description), String(t.amount), t.currency, t.type].join(',')
  );
  return [header, ...rows].join('\n');
}

export function exportJSON(transactions: Transaction[]): string {
  return JSON.stringify(transactions, null, 2);
}

export async function exportExcel(transactions: Transaction[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Transactions');

  sheet.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Currency', key: 'currency', width: 8 },
    { header: 'Type', key: 'type', width: 8 },
  ];

  for (const t of transactions) {
    sheet.addRow({
      date: t.date,
      description: t.description,
      amount: t.amount,
      currency: t.currency,
      type: t.type,
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/__tests__/exporter.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/core/src/exporter.ts packages/core/src/__tests__/exporter.test.ts
git commit -m "feat(core): add CSV, JSON, and Excel exporters"
```

---

## Task 7: Core Package Index (public API)

**Files:**
- Create: `packages/core/src/index.ts`

**Step 1: Write the barrel export**

```typescript
// Types
export type { Transaction, BankParser, ExportOptions, ParseResult } from './types';

// Parser
export { extractText, parseStatement } from './parser';

// Detection
export { detectBank } from './detector';

// Exporters
export { exportCSV, exportJSON, exportExcel } from './exporter';

// Plugin registry
export { plugins, getParserByName, listParsers } from './plugins/index';
```

**Step 2: Build core to verify it compiles**

Run: `npm run build --workspace=packages/core`
Expected: compiles to dist/ without errors

**Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): add public API barrel export"
```

---

## Task 8: CLI — parse + list commands

**Files:**
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/parse.ts`
- Create: `packages/cli/src/commands/list.ts`

**Step 1: Write parse command**

```typescript
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
```

**Step 2: Write list command**

```typescript
import { listParsers } from '@banksheet/core';

export function list(): void {
  const parsers = listParsers();
  console.log('Available bank parsers:\n');
  for (const p of parsers) {
    console.log(`  ${p.name} (${p.country})`);
  }
  console.log(`\nTotal: ${parsers.length} parser(s)`);
}
```

**Step 3: Write CLI entry point**

```typescript
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
```

**Step 4: Test manually with a real PDF**

Run: `npx tsx packages/cli/src/index.ts parse <test-pdf> --format csv`
Expected: CSV output of transactions to stdout

**Step 5: Commit**

```bash
git add packages/cli/src/
git commit -m "feat(cli): add parse and list commands"
```

---

## Task 9: Cleanup Old Structure + Update Docs

**Files:**
- Remove: `src/` directory (empty scaffolding, replaced by packages/)
- Remove: `templates/` directory (will recreate inside core later)
- Update: `CLAUDE.md`
- Update: `docs/ARCHITECTURE.md`

**Step 1: Ask user for permission to delete old empty directories**

The old `src/` and `templates/` directories are empty scaffolding that's now replaced by `packages/`. Confirm with user before deleting.

**Step 2: Update CLAUDE.md architecture link and docs**

Update docs to reflect monorepo structure:
```
packages/
  core/src/            # @banksheet/core — parser engine
    types.ts
    parser.ts
    exporter.ts
    detector.ts
    plugins/
      visa-infinity/   # First plugin (reference implementation)
      index.ts         # Plugin registry
  cli/src/             # @banksheet/cli — terminal interface
    index.ts
    commands/
      parse.ts
      list.ts
  web/                 # @banksheet/web — phase 2
```

**Step 3: Commit**

```bash
git add CLAUDE.md docs/
git commit -m "docs: update architecture for monorepo structure"
```

---

---

## Task 10: Integration Tests (Core Pipeline)

**Files:**
- Create: `packages/core/src/__tests__/integration/pipeline.test.ts`
- Create: `packages/core/src/__tests__/integration/pdf-extraction.test.ts`
- Create: `packages/core/src/__tests__/helpers/generate-pdf.ts`

**Step 1: Write PDF fixture generator (using pdfkit)**

Add `pdfkit` as devDependency in `packages/core/package.json`.

```typescript
// packages/core/src/__tests__/helpers/generate-pdf.ts
import PDFDocument from 'pdfkit';

export function generateVisaInfinityPdf(lines: string[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.text('VISA INFINITY');
    doc.text('Cartão final 9999');
    for (const line of lines) {
      doc.text(line);
    }
    doc.end();
  });
}
```

**Step 2: Write pipeline integration test**

```typescript
// packages/core/src/__tests__/integration/pipeline.test.ts
import { describe, it, expect } from 'vitest';
import { parseStatement, exportCSV, exportJSON, exportExcel } from '../../index';
import { plugins } from '../../plugins/index';

const VISA_TEXT = `
VISA INFINITY
Cartão final 9999
05/01 MERCADO LIVRE              250,00
05/02 SPOTIFY                     34,90
05/03 DEVOLUCAO SPOTIFY          -34,90
05/10 UBER *TRIP                  18,00
05/15 AMAZON PRIME               29,90
`;

describe('Core Pipeline Integration', () => {
  it('detect → parse → exportCSV full flow', () => {
    const result = parseStatement(VISA_TEXT, plugins);
    expect(result.bank).toBe('Visa Infinity');
    expect(result.transactions.length).toBe(5);

    const csv = exportCSV(result.transactions);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('date,description,amount,currency,type');
    expect(lines.length).toBe(6); // header + 5 rows
  });

  it('detect → parse → exportJSON full flow', () => {
    const result = parseStatement(VISA_TEXT, plugins);
    const json = exportJSON(result.transactions);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(5);
    expect(parsed.every((t: any) => t.date && t.description && t.amount !== undefined)).toBe(true);
  });

  it('detect → parse → exportExcel full flow', async () => {
    const result = parseStatement(VISA_TEXT, plugins);
    const buffer = await exportExcel(result.transactions);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('calculates correct total (expenses negative, refunds positive)', () => {
    const result = parseStatement(VISA_TEXT, plugins);
    // 250 + 34.90 - 34.90 + 18 + 29.90 = 297.90 (all expenses except refund)
    // amounts: -250, -34.90, +34.90, -18, -29.90 = -297.90
    expect(result.total).toBeCloseTo(-297.90, 2);
  });

  it('throws for unknown bank text', () => {
    expect(() => parseStatement('random text\nno bank here', plugins))
      .toThrow('No parser detected');
  });

  it('handles text with no valid transaction lines', () => {
    const result = parseStatement('VISA INFINITY\nno transactions here', plugins);
    expect(result.transactions).toHaveLength(0);
  });

  it('explicit bank override works', () => {
    const result = parseStatement(VISA_TEXT, plugins, 'Visa Infinity');
    expect(result.bank).toBe('Visa Infinity');
  });

  it('explicit bank override throws for unknown bank', () => {
    expect(() => parseStatement(VISA_TEXT, plugins, 'Unknown Bank'))
      .toThrow('Parser not found');
  });
});
```

**Step 3: Write PDF extraction integration test**

```typescript
// packages/core/src/__tests__/integration/pdf-extraction.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { extractText, parseStatement } from '../../index';
import { plugins } from '../../plugins/index';
import { generateVisaInfinityPdf } from '../helpers/generate-pdf';

describe('PDF Extraction Integration', () => {
  let pdfBuffer: Buffer;

  beforeAll(async () => {
    pdfBuffer = await generateVisaInfinityPdf([
      '03/01 SUPERMERCADO EXTRA      150,00',
      '03/02 UBER *TRIP              25,50',
    ]);
  });

  it('extracts text from generated PDF', async () => {
    const text = await extractText(pdfBuffer);
    expect(text).toContain('VISA INFINITY');
  });

  it('full pipeline: PDF buffer → text → parse → transactions', async () => {
    const text = await extractText(pdfBuffer);
    const result = parseStatement(text, plugins);
    expect(result.bank).toBe('Visa Infinity');
    expect(result.transactions.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty buffer', async () => {
    await expect(extractText(Buffer.from(''))).rejects.toThrow();
  });

  it('rejects non-PDF buffer', async () => {
    await expect(extractText(Buffer.from('not a pdf'))).rejects.toThrow();
  });
});
```

**Step 4: Run integration tests**

Run: `npx vitest run packages/core/src/__tests__/integration/`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/core/src/__tests__/integration/ packages/core/src/__tests__/helpers/
git commit -m "test(core): add integration tests for full parsing pipeline"
```

---

## Task 11: E2E Tests (CLI)

**Files:**
- Create: `packages/cli/src/__tests__/e2e/cli.test.ts`

**Step 1: Write E2E tests**

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const exec = promisify(execFile);
const CLI = path.resolve(__dirname, '../../../../cli/src/index.ts');
const run = (args: string[]) =>
  exec('npx', ['tsx', CLI, ...args], {
    cwd: path.resolve(__dirname, '../../../../../'),
    shell: true,
  });

// Generate a test PDF before all tests
let fixtureDir: string;
let fixturePdf: string;

beforeAll(async () => {
  // Use the helper from core to generate a fixture
  const { generateVisaInfinityPdf } = await import(
    '../../../../core/src/__tests__/helpers/generate-pdf'
  );
  fixtureDir = path.resolve(__dirname, '../fixtures');
  fs.mkdirSync(fixtureDir, { recursive: true });
  fixturePdf = path.join(fixtureDir, 'test-visa.pdf');

  const buffer = await generateVisaInfinityPdf([
    '03/01 SUPERMERCADO EXTRA      150,00',
    '03/02 UBER *TRIP              25,50',
    '03/03 AMAZON PRIME            -19,90',
  ]);
  fs.writeFileSync(fixturePdf, buffer);
});

afterEach(() => {
  // Clean up any output files
  const outputXlsx = path.join(fixtureDir, 'output.xlsx');
  if (fs.existsSync(outputXlsx)) fs.unlinkSync(outputXlsx);
});

describe('CLI E2E', () => {
  it('banksheet list — shows available parsers', async () => {
    const { stdout } = await run(['list']);
    expect(stdout).toContain('Visa Infinity');
    expect(stdout).toContain('BR');
  });

  it('banksheet parse <pdf> --format csv — outputs CSV', async () => {
    const { stdout } = await run(['parse', fixturePdf, '--format', 'csv']);
    expect(stdout).toContain('date,description,amount,currency,type');
    expect(stdout.split('\n').length).toBeGreaterThanOrEqual(2);
  });

  it('banksheet parse <pdf> --format json — outputs valid JSON', async () => {
    const { stdout } = await run(['parse', fixturePdf, '--format', 'json']);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
  });

  it('banksheet parse <pdf> --format excel -o output.xlsx — creates file', async () => {
    const outputPath = path.join(fixtureDir, 'output.xlsx');
    await run(['parse', fixturePdf, '--format', 'excel', '-o', outputPath]);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
  });

  it('banksheet parse nonexistent.pdf — exits with error', async () => {
    await expect(run(['parse', 'nonexistent.pdf'])).rejects.toThrow();
  });

  it('banksheet parse <pdf> --bank "Unknown" — exits with error', async () => {
    await expect(
      run(['parse', fixturePdf, '--bank', 'Unknown Bank'])
    ).rejects.toThrow();
  });

  it('banksheet (no args) — shows help', async () => {
    const { stdout } = await run(['--help']);
    expect(stdout).toContain('banksheet');
    expect(stdout).toContain('parse');
    expect(stdout).toContain('list');
  });
});
```

**Step 2: Run E2E tests**

Run: `npx vitest run packages/cli/src/__tests__/e2e/`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add packages/cli/src/__tests__/
git commit -m "test(cli): add E2E tests for all CLI commands"
```

---

## Task 12: Coverage Configuration + Thresholds

**Files:**
- Create: `packages/core/vitest.config.ts`
- Create: `packages/cli/vitest.config.ts`
- Update: root `package.json` (add test:coverage script)

**Step 1: Create packages/core/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/**/index.ts'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
```

**Step 2: Create packages/cli/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**'],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
      },
    },
  },
});
```

**Step 3: Add coverage scripts to root package.json**

Add to root `package.json` scripts:
```json
"test:coverage": "npm run test:coverage --workspaces"
```

Add to each package's `package.json` scripts:
```json
"test:coverage": "vitest run --coverage"
```

**Step 4: Add `@vitest/coverage-v8` as devDep to both packages**

Run: `npm install -D @vitest/coverage-v8 --workspace=packages/core --workspace=packages/cli`

**Step 5: Run coverage and verify thresholds pass**

Run: `npm run test:coverage`
Expected: All tests pass, coverage meets thresholds

**Step 6: Commit**

```bash
git add packages/core/vitest.config.ts packages/cli/vitest.config.ts package.json packages/core/package.json packages/cli/package.json
git commit -m "test: add coverage configuration with thresholds"
```

---

## Task 13: Cleanup Old Structure + Update Docs

(Previously Task 9 — renumbered)

**Files:**
- Remove: `src/` directory (empty scaffolding, replaced by packages/)
- Remove: `templates/` directory (will recreate inside core later)
- Update: `CLAUDE.md`
- Update: `docs/ARCHITECTURE.md`

**Step 1: Ask user for permission to delete old empty directories**

The old `src/` and `templates/` directories are empty scaffolding that's now replaced by `packages/`. Confirm with user before deleting.

**Step 2: Update CLAUDE.md architecture link and docs**

Update docs to reflect monorepo structure:
```
packages/
  core/src/            # @banksheet/core — parser engine
    types.ts
    parser.ts
    exporter.ts
    detector.ts
    plugins/
      visa-infinity/   # First plugin (reference implementation)
      index.ts         # Plugin registry
    __tests__/
      integration/     # Pipeline + PDF extraction tests
      helpers/         # Test utilities (PDF generator)
  cli/src/             # @banksheet/cli — terminal interface
    index.ts
    commands/
      parse.ts
      list.ts
    __tests__/
      e2e/             # CLI end-to-end tests
  web/                 # @banksheet/web — phase 2
```

**Step 3: Commit**

```bash
git add CLAUDE.md docs/
git commit -m "docs: update architecture for monorepo structure"
```

---

## Summary

| Task | What | Model |
|------|------|-------|
| 1 | Monorepo scaffolding | haiku |
| 2 | Core types | haiku |
| 3 | Visa Infinity plugin + unit tests | sonnet |
| 4 | Parser orchestrator + unit tests | sonnet |
| 5 | Plugin registry + detection + unit tests | haiku |
| 6 | Exporters + unit tests | sonnet |
| 7 | Core barrel export | haiku |
| 8 | CLI (parse + list) | sonnet |
| 9 | **Cleanup old dirs + update docs** | haiku |
| 10 | **Integration tests (core pipeline)** | sonnet |
| 11 | **E2E tests (CLI)** | sonnet |
| 12 | **Coverage config + thresholds** | haiku |
| 13 | **Cleanup old structure + update docs** | haiku |

## Test Layers

| Layer | Location | What it tests | Count |
|-------|----------|--------------|-------|
| Unit | `packages/core/src/**/__tests__/*.test.ts` | Individual modules in isolation | ~20 tests |
| Integration | `packages/core/src/__tests__/integration/` | Core pipeline end-to-end (no CLI) | ~10 tests |
| E2E | `packages/cli/src/__tests__/e2e/` | Full CLI binary via child_process | ~7 tests |

## Risk Checklist

| Risk | Mitigation |
|------|-----------|
| `pdf-parse` may behave differently on Windows | Integration test with generated PDF catches this |
| No real PDF fixture | Generated with `pdfkit` in test `beforeAll` — no real data committed |
| ExcelJS buffer type differences across Node versions | Pin Node >=18, test Buffer.isBuffer assertion |
| CLI e2e tests are slow (spawn processes) | Separate test dir, can run independently |
| Coverage drops when adding plugins later | Threshold enforced per-package |
| `npm workspaces` symlink issues on Windows | Use `npm install`, verify in task 1 |

## Verification

After all tasks:
```bash
# Unit + Integration tests with coverage
npm run test:coverage --workspace=packages/core
# E2E tests
npm test --workspace=packages/cli
# Manual smoke test
npx tsx packages/cli/src/index.ts list
npx tsx packages/cli/src/index.ts parse <test.pdf> --format csv
# Full coverage report
npm run test:coverage
```
