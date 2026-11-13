import { compactDate, toCents } from './utils';

/**
 * Pieces shared by the Openbank MX plugins (debit and credit card). Each plugin
 * stays self-contained otherwise; only cross-statement concepts live here.
 */

/**
 * Stable account names used in the `account` / `counterAccount` fields.
 * Name the accounts in your finance app the same, or map them when importing.
 */
export const OPENBANK_ACCOUNTS = {
  debito: 'Openbank Cuenta Débito Open +',
  apartado: 'Openbank Apartado Open',
  credito: 'Openbank Tarjeta de Crédito',
} as const;

/** Name used as payee for rows the bank itself originates (interest). */
export const OPENBANK_PAYEE = 'Openbank';

/** Bank promotions ("Abono por promoción") are paid by the bank itself. */
const PROMOTION_RE = /^abono por promoci[oó]n\b/i;

export function isPromotion(description: string): boolean {
  return PROMOTION_RE.test(description.trim());
}

/** Label of a credit card payment, printed the same in the debit and the card statement. */
const CARD_PAYMENT_RE = /^pago de tarjeta de cr[eé]dito$/i;

export function isCardPayment(description: string): boolean {
  return CARD_PAYMENT_RE.test(description.trim());
}

/**
 * The same ID for both sides of a card payment (debit withdrawal and card credit),
 * so an importer that deduplicates on external ID records the payment only once,
 * even when the two statements are imported separately.
 */
export function cardPaymentExternalId(date: string, amount: number, n: number): string {
  return `openbank-pago-tdc:${compactDate(date)}:${toCents(Math.abs(amount))}:${n}`;
}
