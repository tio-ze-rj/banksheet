# @banksheet/core

Bank statement parsing engine — converts credit card PDF statements into structured data (CSV, Excel, JSON).

## Supported Banks

| Bank | Country | Type | Tested with real PDF |
|------|---------|------|:--------------------:|
| Bradesco | BR | Credit Card | Yes |
| C6 Bank | BR | Credit Card | Yes |
| Inter | BR | Credit Card | Yes |
| Itaú | BR | Credit Card | Yes |
| Nubank | BR | Credit Card | Yes |
| Porto Seguro | BR | Credit Card | Yes |
| PC Financial Mastercard | CA | Credit Card | Yes |
| Chase | US | Credit Card | No |

## Usage

```ts
import { detectParser, parseStatement, exportToCsv } from '@banksheet/core';
import { readFileSync } from 'fs';

const pdf = readFileSync('statement.pdf');
const parser = await detectParser(pdf);

if (parser) {
  const transactions = await parseStatement(pdf, parser);
  const csv = exportToCsv(transactions);
  console.log(csv);
}
```

## API

- `detectParser(buffer)` — auto-detect which bank parser matches the PDF
- `parseStatement(buffer, parser)` — extract transactions from a PDF
- `exportToCsv(transactions)` — export to CSV string
- `exportToExcel(transactions)` — export to Excel buffer
- `exportToJson(transactions)` — export to JSON string

## Adding Parsers

See the [Plugin Development Guide](https://github.com/tio-ze-rj/banksheet/blob/main/docs/PLUGIN_GUIDE.md).

## License

MIT
