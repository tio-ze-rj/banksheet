# Inter Cartão (Banco Inter Credit Card)

**Country:** BR
**Implemented:** 2026-03-18

## Detection

Markers: `BANCO INTER S/A`, `bancointer.com.br`, `Banco Inter`, `Cartão Inter`

## PDF Notes

- **Password-protected** — requires `--password` flag
- Transaction section starts after `Despesas da fatura`
- Grouped by card: `CARTÃO XXXX****XXXX`
- Date format: `DD de MMM. YYYY` (Portuguese month abbreviations)
- `+ R$` = credit (payment), `- R$` = debit (expense)
- International purchases split amount across multiple lines (currency, exchange rate on separate lines)
- IOF lines are separate transactions
