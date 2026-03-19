# C6 Cartão (C6 Bank Credit Card)

**Country:** BR
**Implemented:** 2026-03-18

## Detection

Markers: `C6 Bank`, `C6 Carbon`, `Banco C6 S.A.`, CNPJ `31.872.495/0001-72`

## PDF Notes

- **Password-protected** — requires `--password` flag
- Transaction format: `DD mmm DESCRIPTION AMOUNT` (e.g., `23 jan PADARIA SABOR 17,97`)
- Month abbreviation in lowercase Portuguese (jan, fev, mar, ...)
- Amount in BR format (comma decimal, dot thousands) — no `R$` prefix on transaction lines
- Multiple card sections: principal, virtual (`C6 Carbon Virtual`), additional cards
- Each card section has a subtotal header: `C6 Carbon Final NNNN - NAME Subtotal deste cartão R$ AMOUNT`
- Installments preserved in description: `- Parcela NN/NN`
- Credits detected by: `- Estorno` suffix or `Inclusao de Pagamento` description
- Year derived from closing date (`fechamento desta fatura em DD/MM/YY`); months after closing month assigned to previous year (handles installment original purchase dates)
- Page header repeats on every page (vencimento, valor, card holder info) — ignored by regex-only matching
