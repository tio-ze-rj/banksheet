# Openbank México — Tarjeta de Crédito Open

## Detection markers
`Openbank` + `CARGOS, ABONOS Y COMPRAS REGULARES`

## Sections parsed ("DESGLOSE DE MOVIMIENTOS")
### Regular movements — `CARGOS, ABONOS Y COMPRAS REGULARES (NO A MESES)`
- Row: `DD-MM-YYYY DD-MM-YYYY descripción <+|-> $ monto` (fecha de operación, fecha de cargo, ...).
  Long descriptions wrap over several lines; the sign + amount always ends the last one.
- `-` is a charge, `+` is a payment/refund => charges are negative. `date` is the operation date and
  `bookingDate` the posting date.
- Empty trailing fields are printed as `, -` (sometimes repeated) and are stripped.
- Foreign purchases: the rate is read from `, por -, tipo de cambio N` or `, -, $ N` into `exchangeRate`
  and removed from the description (the raw line keeps it).

### Installments without interest — `COMPRAS Y CARGOS DIFERIDOS A MESES SIN INTERESES`
- Row: `fecha descripción $ monto original $ saldo pendiente $ pago requerido NNN tasa %`.
- The purchase appears **only** here, once per month, and the summary line "Cargos compras a meses
  (capital)" is the sum of the monthly `pago requerido`. So each month yields one charge of
  `pago requerido`, dated at the statement's **fecha de corte** (falls back to the purchase date if the
  cut-off is missing), described as `... (MSI n/N)` (N = original / payment). The purchase date, original
  amount and remaining balance go to `notes`. Change the `date` assignment in `finishMsi` if you prefer the
  purchase date instead.
- `externalId` = purchase date + original amount + installment number, so every month is distinct and stable.

## What the parser adds
- **Payee**: the merchant, i.e. the text after `Compra [con Google/Apple Pay] [en línea] en` /
  `Devolución de compra en` up to the first comma (city and country follow). Top-ups (`Recarga <operador> de
  $...`) get the carrier, promotions get `Openbank`. Rows with no recognisable merchant have no payee.
- **Card payments** (`Pago de tarjeta de crédito`) are a transfer from the debit account: `counterAccount` is
  the debit account and the `externalId` is `openbank-pago-tdc:<date>:<amount>:<n>`, the same ID the debit
  statement gives the withdrawal, so an importer that deduplicates on external ID records it once.

## Verified
`sum(charges) = Total cargos` (regular + installments) and `sum(payments/refunds) = Total abonos`, and the
installment sum equals "Cargos compras a meses (capital)", on every sample statement.

## Known limitations
- `COMPRAS Y CARGOS DIFERIDOS A MESES CON INTERESES` (installments with interest) are skipped: no sample.
- Interest, fees and IVA only appear in summary boxes in the samples, not as movement rows.
- The card payment link assumes the payment is made from the Openbank debit account and that both statements
  print it on the same day. A payment from another bank labeled the same way would be linked to the debit
  account too (fix `counterAccount` in the importer if so).
