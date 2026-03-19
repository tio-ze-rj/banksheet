# Plugin Guide

How to add a new bank parser to banksheet. Each plugin is a self-contained folder that implements the `BankParser` interface.

## Overview

```
packages/core/src/plugins/{CC}/{bank-type}/
├── index.ts                 # Parser implementation
├── README.md                # Detection markers, quirks, edge cases
└── __tests__/
    └── parser.test.ts       # Detection + parsing tests
```

`{CC}` = [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) country code (e.g. `BR`, `US`, `GB`).
`{bank-type}` = bank name + statement type in kebab-case (e.g. `itau-cartao`, `chase-checking`).

## Step 1 — Extract and inspect the PDF text

Before writing any code, see what `pdf-parse` extracts from your statement. Create a temporary script:

```typescript
// tmp-inspect.ts
import { extractText } from '@banksheet/core';
import { readFileSync } from 'fs';

const buf = readFileSync('path/to/statement.pdf');
extractText(buf /*, 'password-if-needed' */).then(text => {
  console.log(text);
});
```

Run it:

```bash
npx tsx tmp-inspect.ts > extracted.txt
```

Study the output carefully:
- **Spaces may be removed** — `pdf-parse` often glues words together
- **Columns may merge** — description, city, and amount can run together
- **Page headers repeat** — you'll need to skip them
- **Encoding issues** — accented characters may be mangled

> Delete your temp script and extracted text when done. Never commit real bank statements.

## Step 2 — Create the plugin folder

```
packages/core/src/plugins/{CC}/{bank-type}/
```

Example for a US Chase checking account:

```
packages/core/src/plugins/US/chase-checking/
```

## Step 3 — Implement the parser

Create `index.ts`:

```typescript
import type { BankParser, Transaction } from '../../../types';

// Compile regexes once at module level
const TXN_LINE_RE = /^(\d{2}\/\d{2})\s+(.+?)\s+([\d,.]+)$/;

export const chaseCheckingParser: BankParser = {
  name: 'Chase Checking',
  country: 'US',

  detect(text: string): boolean {
    // Match unique strings that identify this bank's statements.
    // Use multiple markers for reliability.
    return (
      /JPMorgan Chase/i.test(text) &&
      /Checking\s+Summary/i.test(text)
    );
  },

  parse(text: string): Transaction[] {
    const lines = text.split('\n').map(l => l.trim());
    const transactions: Transaction[] = [];

    for (const line of lines) {
      const match = line.match(TXN_LINE_RE);
      if (!match) continue;

      const [, dateStr, description, rawAmount] = match;
      const amount = parseFloat(rawAmount.replace(',', ''));

      transactions.push({
        date: toISO8601(dateStr),    // Convert to YYYY-MM-DD
        description: description.trim(),
        amount: -amount,              // Negative = expense
        currency: 'USD',              // ISO 4217
        type: 'debit',
        raw: line,
      });
    }

    return transactions;
  },
};
```

### Key rules

| Rule | Details |
|------|---------|
| Dates | ISO 8601: `YYYY-MM-DD` |
| Amounts | Negative = expense, positive = income |
| Currency | ISO 4217: `BRL`, `USD`, `EUR` |
| Type | `'debit'` for expenses, `'credit'` for income |
| Regexes | Declare at module level (compiled once) |
| No side effects | Pure function — no file I/O, no network |

### Shared utilities

Brazilian plugins share `plugins/BR/utils.ts`:

```typescript
import { PT_MONTHS, parseBRAmount } from '../utils';

// PT_MONTHS: { 'jan': '01', 'fev': '02', ... }
// parseBRAmount('1.523,81') → 1523.81
```

Create similar utilities for your country if needed (e.g. `plugins/US/utils.ts`).

## Step 4 — Register the plugin

Add your parser to `packages/core/src/plugins/index.ts`:

```typescript
import { chaseCheckingParser } from './US/chase-checking/index';

export const plugins: BankParser[] = [
  // ...existing parsers
  chaseCheckingParser,
];
```

## Step 5 — Write tests

Create `__tests__/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { chaseCheckingParser } from '../index';

describe('chaseCheckingParser', () => {
  // --- Detection tests ---
  describe('detect', () => {
    it('detects JPMorgan Chase checking statement', () => {
      const text = 'JPMorgan Chase Bank\nChecking Summary\nAccount: ****1234';
      expect(chaseCheckingParser.detect(text)).toBe(true);
    });

    it('does not detect unrelated text', () => {
      expect(chaseCheckingParser.detect('Bank of America Statement')).toBe(false);
    });
  });

  // --- Parsing tests ---
  describe('parse', () => {
    const SAMPLE_TEXT = [
      'JPMorgan Chase Bank',
      'Checking Summary',
      '',
      '01/15  GROCERY STORE  45.67',
      '01/16  GAS STATION  30.00',
      '01/17  DIRECT DEPOSIT  2,500.00',
    ].join('\n');

    it('extracts transactions', () => {
      const txns = chaseCheckingParser.parse(SAMPLE_TEXT);
      expect(txns.length).toBeGreaterThan(0);
    });

    it('formats dates as ISO 8601', () => {
      const txns = chaseCheckingParser.parse(SAMPLE_TEXT);
      expect(txns[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('uses correct currency', () => {
      const txns = chaseCheckingParser.parse(SAMPLE_TEXT);
      expect(txns[0].currency).toBe('USD');
    });

    it('sets negative amounts for expenses', () => {
      const txns = chaseCheckingParser.parse(SAMPLE_TEXT);
      const expense = txns.find(t => t.type === 'debit');
      expect(expense?.amount).toBeLessThan(0);
    });
  });
});
```

**Test guidelines:**
- Use inline sample text (never commit real PDFs)
- Test both `detect` (true and false cases) and `parse`
- Verify date format, currency, amount sign, and edge cases

Run your tests:

```bash
npm test -w packages/core
```

## Step 6 — Document the plugin

Create `README.md` in your plugin folder:

```markdown
# Chase Checking

Parser for JPMorgan Chase checking account statements (US).

Implemented: YYYY-MM-DD

## Detection

Matches on: `JPMorgan Chase` + `Checking Summary`

## PDF Extraction Quirks

- Columns are space-separated with consistent alignment
- Page headers repeat on every page
- ...

## Transaction Format

\`\`\`
MM/DD  DESCRIPTION  AMOUNT
01/15  GROCERY STORE  45.67
\`\`\`

## Edge Cases

- Pending transactions appear without amounts
- ...
```

## Step 7 — Update the detector test

Add a detection test in `packages/core/src/__tests__/detector.test.ts` for the new parser.

## Step 8 — Build and run full test suite

```bash
npm run build
npm test
```

All tests must pass before submitting a PR.

## Checklist

- [ ] PDF text inspected and quirks documented
- [ ] `index.ts` implements `BankParser` with `detect()` and `parse()`
- [ ] Registered in `packages/core/src/plugins/index.ts`
- [ ] `__tests__/parser.test.ts` covers detection and parsing
- [ ] `README.md` documents detection markers and quirks
- [ ] Detector integration test added
- [ ] `npm test` passes
- [ ] No real bank data committed
