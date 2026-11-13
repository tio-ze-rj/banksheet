import { describe, it, expect } from 'vitest';
import { openbankCreditoParser } from '../index';
import { openbankDebitoParser } from '../../openbank-debito/index';
import { OPENBANK_ACCOUNTS } from '../../openbank-common';
import { parseStatement } from '../../../../parser';
import { plugins } from '../../../index';

const PAGE_BREAK = [
  '--- PAGE BREAK ---',
  'Emitido por Openbank México, S.A., Institución de Banca Múltiple, Ciudad Ejemplo.',
  'Página 5 de 10',
  'Notas',
  'Ver las notas en la sección "Notas" en este estado de cuenta.',
  'Número de cuenta: ************1234',
];

// Synthetic statement modeled after the extracted text of an Openbank MX credit
// card statement. All merchants, card numbers and amounts are fictitious.
const SAMPLE = [
  'Tarjeta de Crédito Open / CREDIT',
  'Fecha de corte 26-03-2026',
  'Número de cuenta: ************1234',
  'DESGLOSE DE MOVIMIENTOS',
  'COMPRAS Y CARGOS DIFERIDOS A MESES SIN INTERESES',
  'Tarjeta titular 1234',
  'Fecha de la operación Descripción Monto original Saldo pendiente Pago requerido Núm. de pago Tasa de interés',
  'aplicable',
  '15-01-2026 Compra en línea en Tienda Ejemplo,',
  'Ciudad Ejemplo, por -, tipo de cambio',
  '17.5000',
  '$ 3,000.00 $ 1,000.00 $ 1,000.00 003 0.0 %',
  '20-02-2026 Compra en Comercio Demo, Ciudad Ejemplo, - $ 1,200.00 $ 1,100.00 $ 100.00 001 0.0 %',
  'COMPRAS Y CARGOS DIFERIDOS A MESES SIN INTERESES',
  'Tarjeta adicional',
  'Fecha de la operación Descripción Monto original Saldo pendiente Pago requerido Núm. de pago Tasa de interés',
  'aplicable',
  'COMPRAS Y CARGOS DIFERIDOS A MESES CON INTERESES',
  'Tarjeta titular 1234',
  '01-02-2026 Compra con intereses $ 900.00 $ 600.00 $ 10.00 $ 1.60 $ 100.00 002 30.0 %',
  'CARGOS, ABONOS Y COMPRAS REGULARES (NO A MESES)',
  'Tarjeta titular 1234',
  'Fecha de la operación Fecha de cargo Descripción del movimiento Monto',
  '01-03-2026 02-03-2026 Compra en Tienda Ejemplo, Ciudad Ejemplo, - - $ 250.50',
  '03-03-2026 04-03-2026 Compra en COMERCIO DEMO, CIUDAD DEMO, -, $ 18.1234 - $ 321.09',
  '05-03-2026 06-03-2026 Compra en línea en Servicio Demo, Ciudad Ejemplo, por -, tipo de cambio',
  '18.5678',
  '- $ 1,234.56',
  ...PAGE_BREAK,
  '10-03-2026 10-03-2026 Pago de tarjeta de crédito + $ 5,000.00',
  '12-03-2026 13-03-2026 Compra con Google Pay en Cafe Ejemplo, Ciudad Ejemplo - $ 80.00',
  '12-03-2026 13-03-2026 Compra con Google Pay en Cafe Ejemplo, Ciudad Ejemplo - $ 80.00',
  '13-03-2026 13-03-2026 Recarga Operador Demo de $50.0 al 0000000000 - $ 50.00',
  '14-03-2026 15-03-2026 Devolución de compra en TIENDA DEMO, CIUDAD DEMO, - + $ 100.00',
  '15-03-2026 15-03-2026 Abono por promoción + $ 25.00',
  'CARGOS, ABONOS Y COMPRAS REGULARES (NO A MESES)',
  'Tarjeta adicional',
  'Fecha de la operación Fecha de cargo Descripción del movimiento Monto',
  'Total cargos + $ 3,116.15',
  'Total abonos - $ 5,125.00',
  'CARGOS NO RECONOCIDOS',
  '16-03-2026 17-03-2026 No es un movimiento - $ 1.00',
  'ATENCIÓN DE QUEJAS',
].join('\n');

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

describe('openbankCreditoParser', () => {
  describe('detect', () => {
    it('detects an Openbank credit card statement', () => {
      expect(openbankCreditoParser.detect(SAMPLE)).toBe(true);
    });

    it('requires both markers', () => {
      expect(openbankCreditoParser.detect('Openbank México')).toBe(false);
      expect(openbankCreditoParser.detect('CARGOS, ABONOS Y COMPRAS REGULARES')).toBe(false);
    });

    it('is the parser picked for the statement by the detector', () => {
      expect(openbankDebitoParser.detect(SAMPLE)).toBe(false);
      expect(parseStatement(SAMPLE, plugins).bank).toBe('Openbank Crédito');
    });
  });

  describe('parse', () => {
    const txns = openbankCreditoParser.parse(SAMPLE);
    const regular = txns.filter(t => !t.externalId!.startsWith('openbank-credito-msi:'));
    const msi = txns.filter(t => t.externalId!.startsWith('openbank-credito-msi:'));

    it('parses regular movements and installments, skipping other tables', () => {
      expect(regular).toHaveLength(9);
      expect(msi).toHaveLength(2);
      expect(txns.some(t => t.description.includes('intereses'))).toBe(false);
      expect(txns.some(t => t.description.includes('No es un movimiento'))).toBe(false);
    });

    it('matches the statement totals', () => {
      expect(sum(txns.filter(t => t.amount < 0).map(t => -t.amount))).toBe(3116.15);
      expect(sum(txns.filter(t => t.amount > 0).map(t => t.amount))).toBe(5125);
    });

    it('sets MXN, the card account and consistent type/sign', () => {
      for (const t of txns) {
        expect(t.currency).toBe('MXN');
        expect(t.account).toBe(OPENBANK_ACCOUNTS.credito);
        expect(t.type).toBe(t.amount < 0 ? 'debit' : 'credit');
      }
    });

    it('parses a charge with operation and posting dates', () => {
      const t = regular[0];
      expect(t).toMatchObject({
        date: '2026-03-01',
        bookingDate: '2026-03-02',
        description: 'Compra en Tienda Ejemplo, Ciudad Ejemplo',
        amount: -250.5,
        type: 'debit',
        externalId: 'openbank-credito:20260301:-25050:1',
      });
      expect(t.exchangeRate).toBeUndefined();
    });

    it('parses payments and refunds as positive credits', () => {
      const payment = regular.find(t => t.description === 'Pago de tarjeta de crédito')!;
      expect(payment.amount).toBe(5000);
      expect(payment.type).toBe('credit');
      expect(regular.find(t => t.description === 'Devolución de compra en TIENDA DEMO, CIUDAD DEMO')!.amount).toBe(100);
    });

    it('links card payments to the debit account with the shared payment ID', () => {
      const payment = regular.find(t => t.description === 'Pago de tarjeta de crédito')!;
      expect(payment.counterAccount).toBe(OPENBANK_ACCOUNTS.debito);
      expect(payment.externalId).toBe('openbank-pago-tdc:20260310:500000:1');
      expect(payment.payee).toBeUndefined();
    });

    it('extracts the merchant as payee', () => {
      const payees = (amount: number) => txns.filter(t => t.amount === amount).map(t => t.payee);
      expect(payees(-250.5)).toEqual(['Tienda Ejemplo']);
      expect(payees(-321.09)).toEqual(['COMERCIO DEMO']);
      expect(payees(-1234.56)).toEqual(['Servicio Demo']);
      expect(payees(-80)).toEqual(['Cafe Ejemplo', 'Cafe Ejemplo']);
      expect(payees(-50)).toEqual(['Operador Demo']);
      expect(payees(100)).toEqual(['TIENDA DEMO']);
      expect(payees(25)).toEqual(['Openbank']);
      expect(payees(-1000)).toEqual(['Tienda Ejemplo']); // installment
    });

    it('reads the "-, $ N" exchange-rate variant', () => {
      const t = regular.find(t => t.amount === -321.09)!;
      expect(t.exchangeRate).toBe(18.1234);
      expect(t.description).toBe('Compra en COMERCIO DEMO, CIUDAD DEMO');
      expect(t.raw).toContain('$ 18.1234');
    });

    it('joins wrapped rows and reads the "tipo de cambio N" variant', () => {
      const t = regular.find(t => t.amount === -1234.56)!;
      expect(t.date).toBe('2026-03-05');
      expect(t.description).toBe('Compra en línea en Servicio Demo, Ciudad Ejemplo');
      expect(t.exchangeRate).toBe(18.5678);
    });

    it('ignores page-break lines between rows', () => {
      expect(txns.some(t => t.description.includes('Número de cuenta'))).toBe(false);
      expect(txns.some(t => t.raw!.includes('PAGE BREAK'))).toBe(false);
    });

    it('numbers identical lines so externalIds stay unique', () => {
      const dupes = regular.filter(t => t.amount === -80);
      expect(dupes.map(t => t.externalId)).toEqual([
        'openbank-credito:20260312:-8000:1',
        'openbank-credito:20260312:-8000:2',
      ]);
      const ids = txns.map(t => t.externalId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('turns each installment into one charge of the required payment at the cut-off date', () => {
      const [first, second] = msi;
      expect(first).toMatchObject({
        date: '2026-03-26',
        bookingDate: '2026-03-26',
        description: 'Compra en línea en Tienda Ejemplo, Ciudad Ejemplo (MSI 3/3)',
        amount: -1000,
        type: 'debit',
        exchangeRate: 17.5,
        externalId: 'openbank-credito-msi:20260115:300000:003:1',
        notes: 'Compra a meses sin intereses del 2026-01-15; monto original 3,000.00; saldo pendiente 1,000.00',
      });
      expect(second).toMatchObject({
        description: 'Compra en Comercio Demo, Ciudad Ejemplo (MSI 1/12)',
        amount: -100,
        externalId: 'openbank-credito-msi:20260220:120000:001:1',
      });
      expect(second.exchangeRate).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('dates installments at the purchase date when the cut-off date is missing', () => {
      const text = [
        'Openbank',
        'COMPRAS Y CARGOS DIFERIDOS A MESES SIN INTERESES',
        '20-02-2026 Compra en Comercio Demo $ 600.00 $ 400.00 $ 200.00 001 0.0 %',
      ].join('\n');
      const [t] = openbankCreditoParser.parse(text);
      expect(t.date).toBe('2026-02-20');
      expect(t.description).toBe('Compra en Comercio Demo (MSI 1/3)');
    });

    it('drops an unfinished row cut by a header line', () => {
      const text = [
        'Openbank',
        'CARGOS, ABONOS Y COMPRAS REGULARES (NO A MESES)',
        '01-03-2026 02-03-2026 Compra en Tienda Ejemplo,',
        'Página 2 de 3',
        '- $ 10.00',
        '02-03-2026 03-03-2026 Compra en Comercio Demo - $ 20.00',
      ].join('\n');
      const txns = openbankCreditoParser.parse(text);
      expect(txns).toHaveLength(1);
      expect(txns[0].amount).toBe(-20);
    });

    it('ignores rows outside the movement tables', () => {
      const text = ['Openbank', '01-03-2026 02-03-2026 Compra en Tienda Ejemplo - $ 10.00'].join('\n');
      expect(openbankCreditoParser.parse(text)).toEqual([]);
    });
  });
});
