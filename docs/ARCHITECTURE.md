# Architecture

Monorepo with npm workspaces. Each package is independently buildable and publishable.

```
packages/
  core/                # @banksheet/core — parser engine (pure library)
    src/
      types.ts         # Transaction, BankParser, ExportOptions, ParseResult
      parser.ts        # PDF buffer → text → plugin → transactions
      exporter.ts      # CSV, JSON, Excel (exceljs) export
      detector.ts      # Auto-detect bank by running each plugin's detect()
      plugins/
        index.ts       # Plugin registry (plugins[], getParserByName, listParsers)
        itau-cartao/   # First plugin (Brazilian Itaú Cartão statements)
          index.ts     # implements BankParser
      __tests__/       # Unit + integration tests (48 tests, 100% coverage)
  cli/                 # @banksheet/cli — terminal interface (commander)
    src/
      index.ts         # Entry point, registers commands
      commands/
        parse.ts       # banksheet parse <file> [options]
        list.ts        # banksheet list (show available plugins)
      __tests__/       # E2E tests via child_process (7 tests)
  web/                 # @banksheet/web — placeholder for phase 2
reference/             # Original parsing code from perasapi (read-only reference)
docs/                  # Project documentation
```

## Core Interfaces

```typescript
interface Transaction {
  date: string           // ISO 8601: YYYY-MM-DD
  description: string
  amount: number         // Positive = income, negative = expense
  currency: string       // ISO 4217: USD, BRL, EUR
  type: 'credit' | 'debit'
  category?: string
  raw?: string           // Original line from PDF (debugging)
}

interface BankParser {
  name: string                          // "Nubank", "Chase", "Revolut"
  country: string                       // ISO 3166-1 alpha-2: BR, US, GB
  detect(text: string): boolean         // Can this parser handle this text?
  parse(text: string): Transaction[]    // Extract transactions from PDF text
}

interface ExportOptions {
  format: 'csv' | 'excel' | 'json'
  output?: string                       // Output file path
  currency?: string                     // Override currency
  dateFormat?: string                   // Custom date format for CSV
}
```
