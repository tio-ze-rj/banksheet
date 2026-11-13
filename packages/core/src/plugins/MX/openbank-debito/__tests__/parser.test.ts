import { describe, it, expect } from 'vitest';
import { openbankDebitoParser } from '../index';
import { openbankCreditoParser } from '../../openbank-credito/index';
import { OPENBANK_ACCOUNTS } from '../../openbank-common';
import { parseStatement } from '../../../../parser';
import { plugins } from '../../../index';

const DEBITO = OPENBANK_ACCOUNTS.debito;
const APARTADO = OPENBANK_ACCOUNTS.apartado;
const FOOTER = 'Emitido por Openbank México, S.A., Institución de Banca Múltiple, Ciudad Ejemplo.';

// Synthetic statement modeled after the extracted text of an Openbank MX debit
// statement (two accounts, repeated page headers, wrapped concepts, blank concepts).
// All names, references and amounts are fictitious.
const SAMPLE = [
  'Estado de cuenta',
  'Página 1 de 6',
  '--- PAGE BREAK ---',
  FOOTER,
  'Cuenta Débito Open +',
  'Página 2 de 6',
  'Aquí está el Estado de Cuenta de tu Cuenta Débito Open +.',
  'Saldo inicial $ 0.00',
  'Depósitos $ 12,055.00',
  'Saldo final $ 25.00',
  'Saldo promedio $ 1,000.00',
  'Saldo inicial de $ 0.00',
  'Otros cargos $ 12,030.00',
  'Saldo final $ 25.00',
  'Detalle de tus transacciones',
  'Fecha Concepto Depósito Retiro Saldo MXN',
  '05/03/26 Abono desde Apartado Open $ 10,000.00 $ 10,000.00',
  '05/03/26',
  'Transferencia entre cuentas;',
  'Transferencia SPEI enviada a',
  'MiBanco 0000, BANCO EJEMPLO,',
  '00000000000000000000',
  '00000',
  '$ 9,000.00 $ 1,000.00',
  '05/03/26 Retiro a Apartado Open $ 1,000.00 $ 0.00',
  '10/03/26 Abono por promoción {Abono por promocion} $ 50.00 $ 50.00',
  '12/03/26',
  'Transferencia entre cuentas;',
  'Transferencia SPEI recibida',
  'de la cuenta 0000',
  'BANCO EJEMPLO,REF000000',
  '$ 2,000.00 $ 2,050.00',
  '13/03/26 Pago de tarjeta de crédito $ 2,000.00 $ 50.00',
  '--- PAGE BREAK ---',
  FOOTER,
  'Cuenta Débito Open +',
  'Página 3 de 6',
  'Detalle de tus transacciones',
  'Fecha Concepto Depósito Retiro Saldo MXN',
  '14/03/26 $ 30.00 $ 20.00',
  '15/03/26 $ 5.00 $ 25.00',
  'Fecha Comisiones Monto MXN',
  '--- PAGE BREAK ---',
  FOOTER,
  'Apartado Open',
  'Página 4 de 6',
  'Saldo inicial $ 50,000.00',
  'Saldo final $ 40,524.00',
  'Saldo inicial de $ 50,000.00',
  'Saldo final $ 40,524.00',
  'Detalle de tus transacciones',
  'Fecha Concepto Depósito Retiro Saldo MXN',
  '02/03/26 Abono de intereses $ 15.00 $ 50,015.00',
  '05/03/26 Retiro a Cuenta Débito Open',
  '+ $ 10,000.00 $ 40,015.00',
  '05/03/26 Abono desde Cuenta Débito',
  'Open + $ 1,000.00 $ 41,015.00',
  '06/03/26 $ 12.00 $ 41,027.00',
  '09/03/26 $ 3.00 $ 41,024.00',
  '20/03/26 $ 500.00 $ 40,524.00',
  'Fecha Comisiones Monto MXN',
  '--- PAGE BREAK ---',
  FOOTER,
  'Página 6 de 6',
  'Cuenta Débito Open +',
  'Resumen de tus aclaraciones',
  'Fecha Concepto Monto Folio',
  '$',
].join('\n');

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

describe('openbankDebitoParser', () => {
  describe('detect', () => {
    it('detects an Openbank debit statement', () => {
      expect(openbankDebitoParser.detect(SAMPLE)).toBe(true);
    });

    it('requires both markers', () => {
      expect(openbankDebitoParser.detect('Openbank México')).toBe(false);
      expect(openbankDebitoParser.detect('Detalle de tus transacciones')).toBe(false);
    });

    it('does not detect an Openbank credit card statement', () => {
      expect(openbankDebitoParser.detect('Openbank\nCARGOS, ABONOS Y COMPRAS REGULARES (NO A MESES)')).toBe(false);
    });

    it('is the parser picked for the statement by the detector', () => {
      expect(openbankCreditoParser.detect(SAMPLE)).toBe(false);
      expect(parseStatement(SAMPLE, plugins).bank).toBe('Openbank Débito');
    });
  });

  describe('parse', () => {
    const txns = openbankDebitoParser.parse(SAMPLE);
    const debito = txns.filter(t => t.account === DEBITO);
    const apartado = txns.filter(t => t.account === APARTADO);

    it('parses every row of both accounts', () => {
      expect(txns).toHaveLength(14);
      expect(debito).toHaveLength(8);
      expect(apartado).toHaveLength(6);
    });

    it('uses MXN, ISO dates and consistent type/sign', () => {
      for (const t of txns) {
        expect(t.currency).toBe('MXN');
        expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(t.type).toBe(t.amount < 0 ? 'debit' : 'credit');
      }
      expect(txns[0].date).toBe('2026-03-05');
    });

    it('matches each account balance chain (opening + rows = closing)', () => {
      expect(sum(debito.map(t => t.amount))).toBe(25);
      expect(sum(apartado.map(t => t.amount))).toBe(40524 - 50000);
    });

    it('derives direction from the running balance', () => {
      expect(debito.map(t => t.amount)).toEqual([10000, -9000, -1000, 50, 2000, -2000, -30, 5]);
      expect(apartado.map(t => t.amount)).toEqual([15, -10000, 1000, 12, -3, -500]);
    });

    it('keeps the balance chain across a repeated page header', () => {
      // A blank-concept withdrawal right after the page break: without the balance
      // chain the keyword fallback would treat it as a deposit.
      const row = debito.find(t => t.date === '2026-03-14')!;
      expect(row.amount).toBe(-30);
      expect(row.description).toBe('Retiro');
    });

    it('joins concepts wrapped over several lines', () => {
      const spei = debito.find(t => t.amount === -9000)!;
      expect(spei.description).toBe(
        'Transferencia entre cuentas; Transferencia SPEI enviada a MiBanco 0000, BANCO EJEMPLO, 00000000000000000000 00000',
      );
      expect(spei.raw).toContain('$ 9,000.00 $ 1,000.00');
      expect(spei.counterAccount).toBeUndefined();

      const received = debito.find(t => t.amount === 2000)!;
      expect(received.description).toContain('Transferencia SPEI recibida de la cuenta 0000');
    });

    it('names the SPEI counterparty the same way in both directions', () => {
      expect(debito.find(t => t.amount === -9000)!.payee).toBe('BANCO EJEMPLO 0000');
      expect(debito.find(t => t.amount === 2000)!.payee).toBe('BANCO EJEMPLO 0000');
    });

    it('uses the bank as payee for interest and promotions, none for unknown rows', () => {
      expect(apartado.find(t => t.amount === 15)!.payee).toBe('Openbank');
      expect(apartado.find(t => t.amount === -3)!.payee).toBe('Openbank');
      expect(debito.find(t => t.amount === 50)!.payee).toBe('Openbank');
      expect(debito.find(t => t.date === '2026-03-15')!.payee).toBeUndefined();
      expect(txns.filter(t => t.counterAccount).every(t => t.payee === undefined)).toBe(true);
    });

    it('removes alias text in braces', () => {
      expect(debito.find(t => t.amount === 50)!.description).toBe('Abono por promoción');
    });

    it('labels blank concepts by direction', () => {
      expect(debito.find(t => t.date === '2026-03-15')!.description).toBe('Depósito');
      expect(apartado.find(t => t.amount === -500)!.description).toBe('Retiro');
    });

    it('pairs same-day equal-and-opposite rows as one internal transfer', () => {
      const out = txns.filter(t => t.date === '2026-03-05' && Math.abs(t.amount) === 10000);
      expect(out).toHaveLength(2);
      expect(new Set(out.map(t => t.externalId))).toEqual(new Set(['openbank-xfer:20260305:1000000:1']));
      for (const t of out) {
        expect(t.description).toBe(`Transferencia de ${APARTADO} a ${DEBITO}`);
      }
      expect(out.find(t => t.account === DEBITO)!.counterAccount).toBe(APARTADO);
      expect(out.find(t => t.account === APARTADO)!.counterAccount).toBe(DEBITO);

      const back = txns.filter(t => t.date === '2026-03-05' && Math.abs(t.amount) === 1000);
      expect(back).toHaveLength(2);
      expect(back.every(t => t.externalId === 'openbank-xfer:20260305:100000:1')).toBe(true);
      expect(back.every(t => t.description === `Transferencia de ${DEBITO} a ${APARTADO}`)).toBe(true);
    });

    it('categorises labeled and unlabeled interest', () => {
      const labeled = apartado.find(t => t.amount === 15)!;
      expect(labeled.description).toBe('Abono de intereses');
      expect(labeled.category).toBe('Rendimientos');

      const unlabeled = apartado.find(t => t.amount === 12)!;
      expect(unlabeled.description).toBe('Abono de intereses');
      expect(unlabeled.category).toBe('Rendimientos');
    });

    it('treats a small unpaired Apartado withdrawal as an interest reversal', () => {
      const reversal = apartado.find(t => t.amount === -3)!;
      expect(reversal.description).toBe('Reverso de intereses');
      expect(reversal.category).toBe('Rendimientos');
    });

    it('does not treat a large unlabeled Apartado withdrawal as interest', () => {
      expect(apartado.find(t => t.amount === -500)!.category).toBeUndefined();
    });

    it('does not treat a small unlabeled debit-account deposit as interest', () => {
      expect(debito.find(t => t.amount === 5)!.category).toBeUndefined();
    });

    it('links credit card payments to the credit card account', () => {
      const payment = debito.find(t => t.description === 'Pago de tarjeta de crédito')!;
      expect(payment.amount).toBe(-2000);
      expect(payment.counterAccount).toBe(OPENBANK_ACCOUNTS.credito);
      // Same ID as the payment row in the credit card statement
      expect(payment.externalId).toBe('openbank-pago-tdc:20260313:200000:1');
    });

    it('gives every row a unique, deterministic externalId', () => {
      const ids = txns.map(t => t.externalId);
      const transferIds = ids.filter(id => id!.startsWith('openbank-xfer:'));
      const rowIds = ids.filter(id => !id!.startsWith('openbank-xfer:'));
      expect(transferIds).toHaveLength(4); // 2 transfers x 2 sides
      expect(rowIds.filter(id => id!.startsWith('openbank-pago-tdc:'))).toHaveLength(1);
      expect(new Set(rowIds).size).toBe(rowIds.length);
      expect(debito.find(t => t.date === '2026-03-14')!.externalId).toBe('openbank-debito:debito:20260314:2000:1');
      expect(openbankDebitoParser.parse(SAMPLE).map(t => t.externalId)).toEqual(ids);
    });
  });

  describe('edge cases', () => {
    const header = ['Openbank', 'Cuenta Débito Open +', 'Detalle de tus transacciones'];

    it('falls back to keywords when the balance chain is missing or inconsistent', () => {
      const text = [
        ...header,
        '01/04/26 Retiro a Apartado Open $ 100.00 $ 900.00', // no opening balance
        '02/04/26 Comisión $ 5.00 $ 2,000.00', // inconsistent chain
        '03/04/26 Depósito en efectivo $ 7.00 $ 9,999.00',
      ].join('\n');
      expect(openbankDebitoParser.parse(text).map(t => t.amount)).toEqual([-100, -5, 7]);
    });

    it('numbers otherwise identical rows', () => {
      const text = [
        ...header,
        'Saldo inicial $ 100.00',
        '01/05/26 $ 10.00 $ 110.00',
        '01/05/26 $ 10.00 $ 100.00',
        '01/05/26 $ 10.00 $ 110.00',
      ].join('\n');
      expect(openbankDebitoParser.parse(text).map(t => t.externalId)).toEqual([
        'openbank-debito:debito:20260501:11000:1',
        'openbank-debito:debito:20260501:10000:1',
        'openbank-debito:debito:20260501:11000:2',
      ]);
    });

    it('drops an unfinished wrapped row cut by a table/page line', () => {
      const text = [
        ...header,
        'Saldo inicial $ 100.00',
        '04/04/26',
        'Transferencia SPEI enviada a',
        'Fecha Comisiones Monto MXN',
        '$ 1.00 $ 99.00',
        '05/04/26 Abono por promoción $ 1.00 $ 101.00',
      ].join('\n');
      const txns = openbankDebitoParser.parse(text);
      expect(txns).toHaveLength(1);
      expect(txns[0].description).toBe('Abono por promoción');
    });

    it('drops a date line that never reaches an amount pair', () => {
      const text = [...header, '06/04/26', ...Array.from({ length: 10 }, (_, i) => `texto ${i}`), '$ 1.00 $ 2.00'].join(
        '\n',
      );
      expect(openbankDebitoParser.parse(text)).toHaveLength(0);
    });

    it('pairs a labeled row with the labeled partner, not the first mirror row', () => {
      // Regression: a labeled first row used to make every candidate look "preferred".
      const text = [
        ...header,
        'Saldo inicial $ 0.00',
        '07/04/26 Abono desde Apartado Open $ 500.00 $ 500.00',
        'Apartado Open',
        'Saldo inicial $ 1,000.00',
        '07/04/26 $ 500.00 $ 500.00',
        '07/04/26 Retiro a Cuenta Débito Open + $ 500.00 $ 0.00',
      ].join('\n');
      const txns = openbankDebitoParser.parse(text);
      expect(txns.map(t => t.counterAccount)).toEqual([APARTADO, undefined, DEBITO]);
      expect(txns[0].externalId).toBe(txns[2].externalId);
    });

    it('pairs the labeled row when a blank row of the same amount comes first', () => {
      // An external deposit and an Apartado transfer of the same amount on the same day
      const text = [
        ...header,
        'Saldo inicial $ 0.00',
        '07/04/26 $ 500.00 $ 500.00',
        '07/04/26 Abono desde Apartado Open $ 500.00 $ 1,000.00',
        'Apartado Open',
        'Saldo inicial $ 1,000.00',
        '07/04/26 Retiro a Cuenta Débito Open + $ 500.00 $ 500.00',
      ].join('\n');
      const txns = openbankDebitoParser.parse(text);
      expect(txns.map(t => t.counterAccount)).toEqual([undefined, APARTADO, DEBITO]);
      expect(txns[0].description).toBe('Depósito');
    });

    it('still pairs mirror rows when neither concept is labeled', () => {
      const text = [
        ...header,
        'Saldo inicial $ 0.00',
        '07/04/26 $ 500.00 $ 500.00',
        'Apartado Open',
        'Saldo inicial $ 1,000.00',
        '07/04/26 $ 500.00 $ 500.00',
      ].join('\n');
      expect(openbankDebitoParser.parse(text).map(t => t.counterAccount)).toEqual([APARTADO, DEBITO]);
    });

    it('prefers the transfer partner whose concept names the other account', () => {
      const text = [
        ...header,
        'Saldo inicial $ 0.00',
        '07/04/26 $ 500.00 $ 500.00',
        'Apartado Open',
        'Saldo inicial $ 1,000.00',
        '07/04/26 $ 500.00 $ 500.00',
        '07/04/26 Retiro a Cuenta Débito Open + $ 500.00 $ 0.00',
      ].join('\n');
      const txns = openbankDebitoParser.parse(text);
      expect(txns.map(t => t.counterAccount)).toEqual([APARTADO, undefined, DEBITO]);
      expect(txns[1].description).toBe('Retiro');
    });

    it('returns no transactions for text without rows', () => {
      expect(openbankDebitoParser.parse(header.join('\n'))).toEqual([]);
    });
  });
});
