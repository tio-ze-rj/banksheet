# Bradesco Cartão

Credit card statement parser for Banco Bradesco (Amex/Visa/Mastercard).

- **Bank:** Banco Bradesco S/A
- **Type:** Credit card statement (fatura)
- **Country:** BR
- **Currency:** BRL
- **Implemented:** 2026-03-18

## Detection

Matches PDF text containing `Bradesco Cartões`, `Banco Bradesco S/A`, or `banco.bradesco`.

## Known quirks

- pdf-parse glues city names to transaction descriptions (no separator between columns)
- Payment lines end with `-` suffix to indicate credit
- Multiple card holders appear in the same statement with subtotals
- Installment notation `NN/NN` is glued between description and city
