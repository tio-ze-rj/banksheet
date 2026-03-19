# Contributing to banksheet

Thank you for your interest in contributing! banksheet is a community-driven project — every new bank parser helps someone take control of their financial data.

## Getting Started

```bash
git clone https://github.com/tio-ze-rj/banksheet.git
cd banksheet
npm install
npm run build
npm test
```

**Requirements:** Node.js 18+ and npm.

## How to Contribute

### Adding a bank parser (most common)

This is the highest-impact contribution. See [docs/PLUGIN_GUIDE.md](docs/PLUGIN_GUIDE.md) for a step-by-step walkthrough.

### Bug fixes and improvements

1. Fork the repo and create a branch: `git checkout -b fix/description`
2. Make your changes
3. Run all tests: `npm test`
4. Submit a pull request

### Reporting bugs

Open an issue with:
- Which bank and statement type (e.g. "Nubank credit card")
- What you expected vs what happened
- **Never upload real bank statements** — redact or use fake data

## Project Structure

```
packages/
  core/    # Parser engine, plugins, exporters
  cli/     # Command-line interface
  web/     # Local web UI
```

## Code Conventions

- **Language:** TypeScript, all code and comments in English
- **Dates:** ISO 8601 (`YYYY-MM-DD`)
- **Currency:** ISO 4217 (`BRL`, `USD`, `EUR`)
- **Country codes:** ISO 3166-1 alpha-2 (`BR`, `US`, `GB`)
- **Amounts:** Signed numbers — negative = expense, positive = income
- **Tests:** Vitest — every plugin needs detection and parsing tests
- **No AI, no external APIs, no telemetry**

## Commit Messages

Use short, imperative messages:

```
Add Santander credit card parser
Fix Bradesco date parsing for December statements
Update CLI help text
```

## Running Tests

```bash
npm test                    # All packages
npm test -w packages/core   # Core only
npm test -w packages/cli    # CLI only
npm test -w packages/web    # Web only
npm run test:coverage       # With coverage
```

## Pull Request Checklist

- [ ] Tests pass (`npm test`)
- [ ] New plugin has detection + parsing tests
- [ ] New plugin has a `README.md` documenting detection markers and quirks
- [ ] New plugin is registered in `packages/core/src/plugins/index.ts`
- [ ] Code is in English (comments, variable names, docs)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
