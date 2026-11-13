import type { BankParser, Transaction } from '../../../types';
import { OPENBANK_ACCOUNTS, OPENBANK_PAYEE, cardPaymentExternalId, isCardPayment, isPromotion } from '../openbank-common';
import { compactDate, occurrenceCounter, parseMXAmount, toCents } from '../utils';

// Hoisted regexes — compiled once at module load

// Regular movements (one or more lines; the sign + amount always ends the last one):

const REGULAR_START_RE = /^\d{2}-\d{2}-\d{4}\s+\d{2}-\d{2}-\d{4}(?:\s|$)/;
const REGULAR_END_RE = /[-+]\s*\$\s*[\d,]+\.\d{2}\s*$/;
const REGULAR_RE =
  /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2})-(\d{2})-(\d{4})\s+(.+?)\s+([-+])\s*\$\s*([\d,]+\.\d{2})\s*$/;

// Installment purchases without interest ("COMPRAS Y CARGOS DIFERIDOS A MESES SIN INTERESES"):

const MSI_START_RE = /^\d{2}-\d{2}-\d{4}(?:\s|$)/;
const MSI_END_RE = /\s\d{3}\s+[\d.]+\s*%\s*$/;
const MSI_RE =
  /^(\d{2})-(\d{2})-(\d{4})\s+(.+?)\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+(\d{3})\s+[\d.]+\s*%\s*$/;

const FECHA_CORTE_RE = /^Fecha de corte\s+(\d{2})-(\d{2})-(\d{4})/m;
const NOT_CONTINUATION_RE = /^(---|Página\b|Notas\b|Número de cuenta|Fecha\b|Tarjeta\b|Total\b)/;
const MAX_ROW_LINES = 8;

// Description clean-up
// Foreign purchases come in two shapes:
//   "..., London, por -, tipo de cambio 18.4213"   ("por -" = empty foreign-amount field)
//   "..., SOLA, -, $ 17.4685"
const RATE_POR_RE = /,\s*por\s+[^,]*,\s*tipo de cambio(?:\s+([\d.]+)|\s*-)?\s*$/i;
const RATE_DOLLAR_RE = /,\s*-,\s*\$\s*([\d.]+)\s*$/;
// Empty trailing fields are printed as ", -" (country, city...), sometimes repeated
const TRAILING_DASHES_RE = /(?:,\s*-)+\s*$/;

// Merchant = text after the purchase prefix, up to the first comma (city / country follow):
//   "Compra con Google Pay en Cafe Ejemplo, Ciudad" -> "Cafe Ejemplo"
const PAYEE_PREFIX_RE = /^(?:devoluci[oó]n de compra en|compra(?: con (?:google|apple) pay)?(?: en l[ií]nea)? en)\s+/i;
// Mobile top-ups: "Recarga <carrier> de $150.0 al <phone>" -> "<carrier>"
const TOP_UP_RE = /^recarga\s+(.+?)\s+de\s+\$/i;

type Section = 'none' | 'regular' | 'msi' | 'msiWithInterest';

function extractPayee(description: string): string | undefined {
  if (isPromotion(description)) return OPENBANK_PAYEE;
  const topUp = description.match(TOP_UP_RE);
  if (topUp) return topUp[1];
  const prefix = description.match(PAYEE_PREFIX_RE);
  if (!prefix) return undefined;
  const payee = description.slice(prefix[0].length).split(',')[0].trim();
  return payee || undefined;
}

function cleanDescription(raw: string): { description: string; exchangeRate?: number } {
  let description = raw.replace(/\s+/g, ' ').trim();
  let exchangeRate: number | undefined;

  const por = description.match(RATE_POR_RE);
  if (por) {
    if (por[1]) exchangeRate = parseFloat(por[1]);
    description = description.replace(RATE_POR_RE, '');
  } else {
    const dollar = description.match(RATE_DOLLAR_RE);
    if (dollar) {
      exchangeRate = parseFloat(dollar[1]);
      description = description.replace(RATE_DOLLAR_RE, '');
    }
  }

  description = description.replace(TRAILING_DASHES_RE, '').trim();
  return { description, exchangeRate };
}

function formatMXN(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const openbankCreditoParser: BankParser = {
  name: 'Openbank Crédito',
  country: 'MX',

  detect(text: string): boolean {
    return /Openbank/i.test(text) && /CARGOS, ABONOS Y COMPRAS REGULARES/i.test(text);
  },

  /**
   * Parses the "DESGLOSE DE MOVIMIENTOS" tables of an Openbank credit card statement.
   *
   * Regular movements ("CARGOS, ABONOS Y COMPRAS REGULARES (NO A MESES)"):
   * - `date` is the operation date, `bookingDate` the posting date (fecha de cargo).
   * - Long descriptions wrap over several lines; they are joined.
   * - Foreign purchases expose the rate in `exchangeRate` and drop the rate text
   *   from the description (the raw line keeps it).
   *
   * Installments without interest ("COMPRAS Y CARGOS DIFERIDOS A MESES SIN INTERESES"):
   * - The purchase appears ONLY in this table, once per month, and the statement's
   *   "Cargos compras a meses" total is the sum of the monthly "pago requerido".
   *   So each month produces one charge of `pago requerido`, dated at the statement's
   *   cut-off date (fecha de corte), with the installment number in the description
   *   and the original purchase in `notes`.
   * - Installments WITH interest are not parsed yet (no sample available).
   *
   * Every row gets a deterministic `externalId`; identical lines are numbered.
   * Purchases get the merchant as `payee`. A card payment ("Pago de tarjeta de
   * crédito") is a transfer from the debit account and shares its `externalId`
   * with the withdrawal in the debit statement, so it is imported only once.
   */
  parse(text: string): Transaction[] {
    const cutoff = text.match(FECHA_CORTE_RE);
    const cutoffDate = cutoff ? `${cutoff[3]}-${cutoff[2]}-${cutoff[1]}` : undefined;

    const transactions: Transaction[] = [];
    const nextRegular = occurrenceCounter();
    const nextMsi = occurrenceCounter();
    const nextCardPayment = occurrenceCounter();

    let section: Section = 'none';
    let pending: string[] | null = null;

    const finishRegular = (lines: string[]): void => {
      const joined = lines.join(' ').replace(/\s+/g, ' ').trim();
      const m = joined.match(REGULAR_RE);
      if (!m) return;

      const [, dd, mm, yyyy, bdd, bmm, byyyy, rawDesc, sign, amountStr] = m;
      const value = parseMXAmount(amountStr);
      const amount = sign === '-' ? -value : value;
      const date = `${yyyy}-${mm}-${dd}`;
      const { description, exchangeRate } = cleanDescription(rawDesc);

      const cents = toCents(amount);
      const n = nextRegular(`${date}|${cents}|${description}`);

      const tx: Transaction = {
        date,
        description,
        amount,
        currency: 'MXN',
        type: amount < 0 ? 'debit' : 'credit',
        raw: joined,
        account: OPENBANK_ACCOUNTS.credito,
        externalId: `openbank-credito:${compactDate(date)}:${cents}:${n}`,
        bookingDate: `${byyyy}-${bmm}-${bdd}`,
      };
      if (exchangeRate !== undefined) tx.exchangeRate = exchangeRate;
      const payee = extractPayee(description);
      if (payee) tx.payee = payee;
      if (isCardPayment(description) && amount > 0) {
        tx.counterAccount = OPENBANK_ACCOUNTS.debito;
        tx.externalId = cardPaymentExternalId(date, amount, nextCardPayment(`${date}|${cents}`));
      }
      transactions.push(tx);
    };

    const finishMsi = (lines: string[]): void => {
      const joined = lines.join(' ').replace(/\s+/g, ' ').trim();
      const m = joined.match(MSI_RE);
      if (!m) return;

      const [, dd, mm, yyyy, rawDesc, originalStr, pendingStr, dueStr, numStr] = m;
      const purchaseDate = `${yyyy}-${mm}-${dd}`;
      const original = parseMXAmount(originalStr);
      const remaining = parseMXAmount(pendingStr);
      const due = parseMXAmount(dueStr);
      const installment = parseInt(numStr, 10);
      const total = due > 0 ? Math.max(Math.round(original / due), installment) : undefined;
      const { description: base, exchangeRate } = cleanDescription(rawDesc);

      const date = cutoffDate ?? purchaseDate;
      const originalCents = toCents(original);
      const n = nextMsi(`${purchaseDate}|${originalCents}|${installment}`);

      const tx: Transaction = {
        date,
        description: `${base} (MSI ${installment}${total ? `/${total}` : ''})`,
        amount: -due,
        currency: 'MXN',
        type: 'debit',
        raw: joined,
        account: OPENBANK_ACCOUNTS.credito,
        externalId: `openbank-credito-msi:${compactDate(purchaseDate)}:${originalCents}:${numStr}:${n}`,
        bookingDate: date,
        notes: `Compra a meses sin intereses del ${purchaseDate}; monto original ${formatMXN(original)}; saldo pendiente ${formatMXN(remaining)}`,
      };
      if (exchangeRate !== undefined) tx.exchangeRate = exchangeRate;
      const payee = extractPayee(base);
      if (payee) tx.payee = payee;
      transactions.push(tx);
    };

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;

      // Section headers
      if (/^CARGOS, ABONOS Y COMPRAS REGULARES/i.test(line)) {
        section = 'regular';
        pending = null;
        continue;
      }
      if (/^COMPRAS Y CARGOS DIFERIDOS A MESES SIN INTERESES/i.test(line)) {
        section = 'msi';
        pending = null;
        continue;
      }
      if (/^COMPRAS Y CARGOS DIFERIDOS A MESES CON INTERESES/i.test(line)) {
        section = 'msiWithInterest';
        pending = null;
        continue;
      }
      if (/^(Total cargos|CARGOS NO RECONOCIDOS|ATENCIÓN DE QUEJAS)/i.test(line)) {
        section = 'none';
        pending = null;
        continue;
      }
      if (section === 'none' || section === 'msiWithInterest') continue;

      const isStart = (section === 'regular' ? REGULAR_START_RE : MSI_START_RE).test(line);
      const isEnd = (section === 'regular' ? REGULAR_END_RE : MSI_END_RE).test(line);

      if (isStart) pending = [line];
      else if (pending) {
        if (NOT_CONTINUATION_RE.test(line) || pending.length >= MAX_ROW_LINES) {
          pending = null;
          continue;
        }
        pending.push(line);
      } else {
        continue;
      }

      if (isEnd) {
        if (section === 'regular') finishRegular(pending);
        else finishMsi(pending);
        pending = null;
      }
    }

    return transactions;
  },
};
