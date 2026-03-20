# Chase Credit Card Parser

**Country:** United States (US)
**Currency:** USD (ISO 4217)
**Statement type:** Credit card
**Added:** 2026-03-20
**Tested with real PDF:** No — built from [electrovir/statement-parser](https://github.com/electrovir/statement-parser) patterns

## Detection Markers

- `opening/closing date` + `account number:` (both present)
- `Chase` + `payments and other credits` (both present)
- `JPMorgan Chase`

## PDF Extraction Notes

- **Library:** pdfjs-dist
- **Date format:** `M/DD` or `MM/DD` (no year) — year inferred from statement closing date
- **Statement period:** `opening/closing date MM/DD/YY - MM/DD/YY`
- **Amount format:** `1,234.56` (no dollar sign, commas), `-1,234.56` for credits/payments
- **Sections:** `PAYMENTS AND OTHER CREDITS` → `PURCHASE(S)` → `TOTALS YEAR-TO-DATE`
- **Section end:** `totals year-to-date` terminates parsing

## Transaction Format

```
MM/DD  DESCRIPTION LOCATION ST  AMOUNT
MM/DD  DESCRIPTION LOCATION ST  -AMOUNT    (credit/payment)
```

## Sign Convention

| Statement | Project |
|-----------|---------|
| `235.83` (purchase) | `-235.83` (expense) |
| `-1,581.07` (payment) | `1581.07` (income) |
| `-19.44` (refund) | `19.44` (income) |

## Caveats

This parser was built from patterns in the [electrovir/statement-parser](https://github.com/electrovir/statement-parser) open-source project (MIT license) and sanitized fixtures. It has **not been tested with a real Chase PDF statement**. If you have a Chase statement and encounter parsing issues, please open an issue or PR.
