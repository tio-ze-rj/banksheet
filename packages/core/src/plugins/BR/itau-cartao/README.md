# Itaú Cartão

Credit card statement parser for Banco Itaú Unibanco (Visa Infinity).

- **Bank:** Banco Itaú Unibanco S.A.
- **Type:** Credit card statement (fatura)
- **Country:** BR
- **Currency:** BRL
- **Implemented:** 2026-03-17

## Detection

Matches PDF text containing `ITAUUNIBANCO`, `Banco Itaú`, `BancoItaúS.A`, or `VISA INFINITY`.

## Known quirks

- pdf-parse extracts text with ALL spaces removed (glued together)
- Transaction format: `DD/MMDESCRIPTION[NN/NN]VALUE` (no spaces)
- Installment counts glued to amounts: `01/03169,90`
- Card-final digits glued to descriptions
- IOF surcharge appears only in summary section, not as a transaction line
- "Próximas faturas" section repeats installment transactions (deduplicated)
