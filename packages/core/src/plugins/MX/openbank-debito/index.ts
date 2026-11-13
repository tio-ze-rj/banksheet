import type { BankParser, Transaction } from '../../../types';
import { OPENBANK_ACCOUNTS, OPENBANK_PAYEE, cardPaymentExternalId, isCardPayment, isPromotion } from '../openbank-common';
import {
  compactDate,
  occurrenceCounter,
  parseMXAmount,
  round2,
  toCents,
} from '../utils';

// Hoisted regexes — compiled once at module load
// A transaction starts with a date; its concept may wrap over several lines and
// the "$ amount $ balance" pair always ends the LAST line:
//   "02/09/26 Retiro a Apartado Open $ 12,000.00 $ 0.00"          (one line)
//   "09/01/26" / "Transferencia entre cuentas;" / ... / "$ 50,000.00 $ 1,200.00"
//   "09/01/26 Retiro a Cuenta Débito Open" / "+ $ 51,200.00 $ 65,633.27"
// The Depósito / Retiro columns collapse into ONE amount; the concept may be empty.
const DATE_START_RE = /^(\d{2})\/(\d{2})\/(\d{2})(?:\s+(.*))?$/;
const AMOUNTS_TAIL_RE = /(?:^|\s)\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s*$/;
const SALDO_INICIAL_RE = /^Saldo inicial\s+\$\s*([\d,]+\.\d{2})\s*$/;
const SECTION_RE = /^(Cuenta Débito Open \+|Apartado Open)\s*$/;
const NOT_CONTINUATION_RE = /^(---|Fecha\b|Página\b|Saldo\b|Detalle\b)/;
const BRACES_RE = /\s*\{[^}]*\}/g;
const WITHDRAWAL_HINT_RE = /\b(retiro|pago|cargo|comisi[oó]n)\b/i;
/** A concept naming the *other* account of the statement ("Retiro a Apartado Open" in the debit account...). */
const MENTIONS_OTHER_RE: Record<SectionKey, RegExp> = {
  debito: /apartado/i,
  apartado: /cuenta d[eé]bito/i,
};
const INTEREST_CONCEPT_RE = /^abono de intereses$|^rendimientos?$/i;
const MAX_CONCEPT_LINES = 8;

// SPEI counterparty, as "<BANK> <last 4 digits>" for both directions:
//   "Transferencia SPEI enviada a <alias> 1234, BANCO, <reference>"
//   "Transferencia SPEI recibida de la cuenta 1234 BANCO,<reference>"
const SPEI_SENT_RE = /SPEI enviada a .*?(\d{4}),\s*([^,]+?)\s*,/i;
const SPEI_RECEIVED_RE = /SPEI recibida de la cuenta (\d{4})\s+([^,]+?)\s*,/i;

/** Daily Apartado interest is ~0.03% of the balance; anything above this share is not interest. */
const INTEREST_MAX_BALANCE_SHARE = 0.002;

type SectionKey = 'debito' | 'apartado';

const SECTIONS: Record<string, SectionKey> = {
  'Cuenta Débito Open +': 'debito',
  'Apartado Open': 'apartado',
};

interface Row {
  section: SectionKey;
  date: string;
  concept: string;
  amount: number;
  balance: number;
  prevBalance: number | null;
  raw: string;
  partner?: number; // index of the matching row in the other account (internal transfer)
}

export const openbankDebitoParser: BankParser = {
  name: 'Openbank Débito',
  country: 'MX',

  detect(text: string): boolean {
    return /Openbank/i.test(text) && /Detalle de tus transacciones/i.test(text);
  },

  /**
   * The PDF text has a single amount column for deposits and withdrawals, so the
   * direction is derived from the running balance (balance - previous balance).
   * The opening balance comes from each account's "Saldo inicial" summary line.
   *
   * A statement holds several accounts (Cuenta Débito Open +, Apartado Open), so:
   * - every row carries its `account`;
   * - equal-and-opposite same-day rows in different accounts are internal
   *   transfers: both sides get the same description, `counterAccount` and
   *   `externalId`, so an importer sees them as one transfer;
   * - interest ("Abono de intereses", or small unlabeled Apartado deposits in
   *   statements that leave the concept blank) gets category "Rendimientos".
   *
   * Concepts can wrap over several lines (SPEI transfers etc.); the amount pair
   * ends the last line, so rows are assembled from the date line onwards.
   */
  parse(text: string): Transaction[] {
    const rows = collectRows(text);
    pairTransfers(rows);
    return buildTransactions(rows);
  },
};

function collectRows(text: string): Row[] {
  const rows: Row[] = [];
  let section: SectionKey = 'debito';
  let prevBalance: number | null = null;

  // Row being assembled across lines
  let pending: { date: string; parts: string[]; lines: string[] } | null = null;

  const feed = (fragment: string): void => {
    if (!pending) return;
    const m = fragment.match(AMOUNTS_TAIL_RE);
    if (!m) {
      pending.parts.push(fragment);
      if (pending.parts.length > MAX_CONCEPT_LINES) pending = null; // not a real row
      return;
    }
    const head = fragment.slice(0, m.index).trim();
    if (head) pending.parts.push(head);

    const printed = parseMXAmount(m[1]);
    const balance = parseMXAmount(m[2]);
    const concept = pending.parts
      .join(' ')
      .replace(BRACES_RE, '') // "Abono por promoción {Abono por promocion}"
      .replace(/\s+/g, ' ')
      .trim();

    let amount: number;
    if (prevBalance !== null && round2(Math.abs(balance - prevBalance)) === printed) {
      amount = round2(balance - prevBalance);
    } else {
      // Fallback when the balance chain is unavailable or inconsistent
      amount = WITHDRAWAL_HINT_RE.test(concept) ? -printed : printed;
    }

    rows.push({
      section,
      date: pending.date,
      concept,
      amount,
      balance,
      prevBalance,
      raw: pending.lines.join(' '),
    });
    prevBalance = balance;
    pending = null;
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      pending = null;
      // The same header repeats on every page: only a *change* of account resets state.
      const next = SECTIONS[sectionMatch[1]];
      if (next !== section) {
        section = next;
        prevBalance = null;
      }
      continue;
    }

    const saldoMatch = line.match(SALDO_INICIAL_RE);
    if (saldoMatch) {
      pending = null;
      prevBalance = parseMXAmount(saldoMatch[1]);
      continue;
    }

    const start = line.match(DATE_START_RE);
    if (start) {
      pending = { date: `20${start[3]}-${start[2]}-${start[1]}`, parts: [], lines: [line] };
      feed(start[4] ?? '');
      continue;
    }

    if (pending) {
      if (NOT_CONTINUATION_RE.test(line)) {
        pending = null;
      } else {
        pending.lines.push(line);
        feed(line);
      }
    }
  }

  return rows;
}

function mentionsOther(row: Row): boolean {
  return MENTIONS_OTHER_RE[row.section].test(row.concept);
}

function isMirror(a: Row, b: Row): boolean {
  return a.section !== b.section && a.date === b.date && round2(a.amount + b.amount) === 0;
}

/**
 * Match each row with an equal-and-opposite row of the same day in the other account.
 *
 * Several rows can mirror each other on a busy day (an external SPEI deposit and an
 * Apartado withdrawal of the same amount, blank concepts in redacted statements...),
 * so the most certain pairs are taken first: both concepts name the other account,
 * then one of them does, then neither.
 */
function pairTransfers(rows: Row[]): void {
  for (const minHints of [2, 1, 0]) {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].partner !== undefined) continue;
      for (let j = i + 1; j < rows.length; j++) {
        if (rows[j].partner !== undefined || !isMirror(rows[i], rows[j])) continue;
        if (Number(mentionsOther(rows[i])) + Number(mentionsOther(rows[j])) < minHints) continue;
        rows[i].partner = j;
        rows[j].partner = i;
        break;
      }
    }
  }
}

function isInterest(row: Row): boolean {
  // Newer statements label interest explicitly ("Abono de intereses")
  if (INTEREST_CONCEPT_RE.test(row.concept)) return row.amount > 0;
  // Older/redacted statements leave the concept blank: guess from size and account
  return (
    row.section === 'apartado' &&
    row.amount > 0 &&
    row.concept === '' &&
    row.prevBalance !== null &&
    row.prevBalance > 0 &&
    row.amount <= row.prevBalance * INTEREST_MAX_BALANCE_SHARE
  );
}

/**
 * Small unlabeled withdrawal from the Apartado that is not part of a transfer:
 * the bank nets it against interest (a correction/reversal of a daily accrual).
 */
function isInterestReversal(row: Row): boolean {
  return (
    row.section === 'apartado' &&
    row.amount < 0 &&
    row.concept === '' &&
    row.prevBalance !== null &&
    row.prevBalance > 0 &&
    -row.amount <= row.prevBalance * INTEREST_MAX_BALANCE_SHARE
  );
}

function speiPayee(concept: string): string | undefined {
  const m = concept.match(SPEI_SENT_RE) ?? concept.match(SPEI_RECEIVED_RE);
  return m ? `${m[2]} ${m[1]}` : undefined;
}

function buildTransactions(rows: Row[]): Transaction[] {
  const nextTransferN = occurrenceCounter();
  const nextRowN = occurrenceCounter();
  const nextCardPaymentN = occurrenceCounter();
  const transferN = new Map<string, number>(); // shared by both sides of a pair

  return rows.map((row, idx): Transaction => {
    const account = OPENBANK_ACCOUNTS[row.section];
    const base = {
      date: row.date,
      amount: row.amount,
      currency: 'MXN',
      type: (row.amount < 0 ? 'debit' : 'credit') as 'debit' | 'credit',
      account,
      raw: row.raw,
    };

    // Internal transfer between the account and its Apartado
    if (row.partner !== undefined) {
      const other = rows[row.partner];
      const counterAccount = OPENBANK_ACCOUNTS[other.section];
      const from = row.amount < 0 ? account : counterAccount;
      const to = row.amount < 0 ? counterAccount : account;
      const key = `${row.date}|${toCents(Math.abs(row.amount))}`;
      const pairKey = `${Math.min(idx, row.partner)}`;
      if (!transferN.has(pairKey)) transferN.set(pairKey, nextTransferN(key));
      return {
        ...base,
        description: `Transferencia de ${from} a ${to}`,
        counterAccount,
        externalId: `openbank-xfer:${compactDate(row.date)}:${toCents(Math.abs(row.amount))}:${transferN.get(pairKey)}`,
      };
    }

    const reversal = isInterestReversal(row);
    const interest = reversal || isInterest(row);
    const label = reversal
      ? 'Reverso de intereses'
      : interest
        ? 'Abono de intereses'
        : row.concept || (row.amount < 0 ? 'Retiro' : 'Depósito');

    const tx: Transaction = {
      ...base,
      description: label,
      externalId: `openbank-debito:${row.section}:${compactDate(row.date)}:${toCents(row.balance)}:${nextRowN(
        `${row.section}|${row.date}|${toCents(row.balance)}`,
      )}`,
    };
    if (interest) {
      tx.category = 'Rendimientos';
      tx.payee = OPENBANK_PAYEE;
    } else if (isPromotion(row.concept)) {
      tx.payee = OPENBANK_PAYEE;
    } else {
      const payee = speiPayee(row.concept);
      if (payee) tx.payee = payee;
    }
    if (isCardPayment(row.concept) && row.amount < 0) {
      tx.counterAccount = OPENBANK_ACCOUNTS.credito;
      tx.externalId = cardPaymentExternalId(row.date, row.amount, nextCardPaymentN(`${row.date}|${toCents(row.amount)}`));
    }
    return tx;
  });
}
