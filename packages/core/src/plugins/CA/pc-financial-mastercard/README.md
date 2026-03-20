# PC Financial Mastercard Parser

**Country:** Canada (CA)
**Currency:** CAD (ISO 4217)
**Statement type:** Credit card
**Added:** 2026-03-20

## Detection Markers

- `President's Choice Financial`
- `Presidents Choice Financial`
- `PC Financial`
- `pcfinancial.ca`
- `PC World Mastercard`
- `President's Choice Bank`

## PDF Extraction Notes

- **Library:** pdfjs-dist (keeps spacing intact)
- **Date format:** `DD/MM DD/MM` (transaction date + posting date), no year in transaction lines
- **Year resolution:** Extracted from `Statement date: Mon. DD, YYYY` or `Statement period:` end date
- **Amount format:** `$1,581.00` (positive = purchase), `-$19.44` (negative = credit/payment)
- **Foreign currency:** Multi-line format — line 1 ends with currency code (e.g. `USD`), line 2 has conversion details and CAD amount at end
- **Interest charges:** `PURCHASE INTEREST CHARGE $40.27` (no city/province)
- **Page breaks:** Repeated headers after `--- PAGE BREAK ---`, skipped by parser
- **Section end:** `Interest rates` line terminates transaction parsing

## Transaction Format

```
DD/MM DD/MM DESCRIPTION CITY PROV $AMOUNT
DD/MM DD/MM DESCRIPTION CITY PROV -$AMOUNT     (credit/payment)
DD/MM DD/MM DESCRIPTION CITY STATE CURRENCY     (foreign, line 1)
ORIG_AMOUNT COUNTRY RATE $CAD_AMOUNT            (foreign, line 2)
```

## Sign Convention

| Statement | Project |
|-----------|---------|
| `$235.83` (purchase) | `-235.83` (expense) |
| `-$1,581.00` (payment) | `1581` (income) |
| `-$19.44` (refund) | `19.44` (income) |
