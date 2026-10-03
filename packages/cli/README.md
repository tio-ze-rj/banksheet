# @banksheet/cli

Command-line tool that converts credit card PDF statements into CSV, Excel, or JSON. Built on [@banksheet/core](https://www.npmjs.com/package/@banksheet/core).

## Install

```bash
npm install -g @banksheet/cli
```

Or run it without installing:

```bash
npx @banksheet/cli parse statement.pdf
```

## Usage

```bash
# Parse a statement to CSV (default)
banksheet parse statement.pdf

# Parse multiple files
banksheet parse statement1.pdf statement2.pdf

# Output as Excel
banksheet parse statement.pdf -f excel -o output.xlsx

# Output as JSON
banksheet parse statement.pdf -f json

# Force a specific bank parser
banksheet parse statement.pdf -b "Itaú Cartão"

# Password-protected PDF
banksheet parse statement.pdf -p mypassword

# List available parsers
banksheet list
```

## Options

| Flag | Description |
|------|-------------|
| `-f, --format <format>` | Output format: `csv`, `json`, `excel` (default: `csv`) |
| `-o, --output <path>` | Output file path |
| `-b, --bank <name>` | Bank name (skip auto-detection) |
| `-p, --password <password>` | PDF password for protected files |

## Supported Banks

Bradesco, C6 Bank, Inter, Itaú, Nubank and Porto Seguro (BR), PC Financial Mastercard (CA), and Chase (US). Run `banksheet list` for the current list.

## Privacy

Statements are parsed locally. Nothing is uploaded anywhere.

## License

MIT
