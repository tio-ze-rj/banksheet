# Porto Seguro Cartão (Porto Bank Credit Card)

**Country:** BR
**Implemented:** 2026-03-19

## Detection

Markers: `Porto Bank`, `PORTOSEG S/A`, `cartaoportoseguro.com.br`, CNPJ `04.862.600/0001-10`

## PDF Notes

- Transaction format: `DD/MM DESCRIPTION AMOUNT` (e.g., `26/01 BONANCA ALIMENTOS LTD SAO PAULO BR 36,00`)
- Amount in BR format (comma decimal, dot thousands) — no `R$` prefix on transaction lines
- Negative amounts indicate payments/credits: `-11.642,00`
- Installments appear inline in description: `08/09 BZ` = parcela 08/09
- Location and country code appended to description: `SAO PAULO BRA`, `GUARUJA BRA`, `BZ`
- Services without location: `CARTAO PROTEGIDO 14,90`
- Year derived from due date (`Esta fatura vence em\n01/03/2026`); months after due date month assigned to previous year
- Section starts at `Data Estabelecimento Valor em R$`, ends at `Lançamentos no cartão (final *NNN)`
- Single card holder per section observed; multi-holder behavior unverified
- Issued by PORTOSEG S/A CRED FIN INV (CNPJ 04.862.600/0001-10), boleto via Banco Itaú
