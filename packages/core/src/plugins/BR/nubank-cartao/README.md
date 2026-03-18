# Nubank Cartão (Nubank Credit Card)

**Country:** BR
**Implemented:** 2026-03-18

## Detection

Markers: `Nu Pagamentos S.A.`, `CNPJ 18.236.120`, `nubank`

## PDF Notes

- Not password-protected
- Transaction section starts after `TRANSAÇÕES DE DD MMM A DD MMM`
- Date format: `DD MMM` (Portuguese uppercase month abbreviations: FEV, MAR, etc.)
- Year extracted from `FATURA DD MMM YYYY` header
- `R$ AMOUNT` = debit (expense), `−R$ AMOUNT` = credit (payment)
- International purchases split amount across lines (USD amount, conversion rate, then `R$ AMOUNT`)
- IOF on international purchases appears as separate transaction
- Card holder total and category headers (e.g., "Pagamentos e Financiamentos") are skipped
- Zero-amount "Saldo restante" lines are skipped
