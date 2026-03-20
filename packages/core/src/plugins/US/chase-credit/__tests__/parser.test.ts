import { describe, it, expect } from 'vitest';
import { chaseCreditParser } from '../index';

describe('chaseCreditParser', () => {
  describe('detect', () => {
    it('detects by opening/closing date + account number', () => {
      expect(chaseCreditParser.detect('opening/closing date 12/05/24 - 01/04/25\naccount number: 1234')).toBe(true);
    });

    it('detects by CARDMEMBER + payments header', () => {
      expect(chaseCreditParser.detect('CARDMEMBER SERVICE\npayments and other credits')).toBe(true);
    });

    it('detects by JPMorgan Chase', () => {
      expect(chaseCreditParser.detect('JPMorgan Chase Bank, N.A.')).toBe(true);
    });

    it('does not detect unrelated text', () => {
      expect(chaseCreditParser.detect('Nubank Pagamentos')).toBe(false);
    });

    it('does not detect partial match without context', () => {
      expect(chaseCreditParser.detect('opening/closing date')).toBe(false);
    });
  });

  describe('parse', () => {
    // Sample text modeled after Chase Amazon Prime Visa statement format
    const sampleText = [
      'CARDMEMBER SERVICE',
      'PO BOX 94014',
      'PALATINE, IL 60094-4014',
      '',
      'account number: XXXX XXXX XXXX 4321',
      'opening/closing date 12/05/24 - 01/04/25',
      '',
      'PAYMENTS AND OTHER CREDITS',
      '',
      '12/10 AUTOMATIC PAYMENT - THANK YOU -1,581.07',
      '12/22 AMAZON MARKETPLACE REFUND -19.44',
      '',
      'PURCHASE',
      '',
      '12/06 WHOLEFDS MKT 10567 NEW YORK NY 45.23',
      '12/07 AMAZON.COM*M12A65773 AMZN.COM/BILL WA 37.55',
      '12/07 AMAZON.COM*7M47824N3 AMZN.COM/BILL WA 23.72',
      '12/10 COSTCO WHSE #1234 EAST YORK ON 235.83',
      '12/15 UBER *EATS NEW YORK NY 18.50',
      '12/20 NETFLIX.COM 866-579-7172 CA 22.99',
      '12/25 SHELL OIL 12345678 BROOKLYN NY 59.33',
      '12/28 TARGET 00012345 NEW YORK NY 67.47',
      '1/02 SPOTIFY USA 9.99',
      '1/03 APPLE.COM/BILL 866-712-7753 CA 1,234.56',
      '',
      'TOTALS YEAR-TO-DATE',
      'Total fees charged in 2025 $0.00',
      'Total interest charged in 2025 $40.27',
    ].join('\n');

    it('parses all transactions', () => {
      const txns = chaseCreditParser.parse(sampleText);
      expect(txns).toHaveLength(12);
    });

    it('all transactions have USD currency', () => {
      const txns = chaseCreditParser.parse(sampleText);
      txns.forEach(t => expect(t.currency).toBe('USD'));
    });

    it('parses payment as credit with positive amount', () => {
      const txns = chaseCreditParser.parse(sampleText);
      const payment = txns.find(t => t.description.includes('AUTOMATIC PAYMENT'));
      expect(payment).toBeDefined();
      expect(payment!.amount).toBe(1581.07);
      expect(payment!.type).toBe('credit');
    });

    it('parses refund as credit with positive amount', () => {
      const txns = chaseCreditParser.parse(sampleText);
      const refund = txns.find(t => t.description.includes('AMAZON MARKETPLACE REFUND'));
      expect(refund).toBeDefined();
      expect(refund!.amount).toBe(19.44);
      expect(refund!.type).toBe('credit');
    });

    it('parses purchase as debit with negative amount', () => {
      const txns = chaseCreditParser.parse(sampleText);
      const costco = txns.find(t => t.description.includes('COSTCO'));
      expect(costco).toBeDefined();
      expect(costco!.amount).toBe(-235.83);
      expect(costco!.type).toBe('debit');
    });

    it('parses amount with commas correctly', () => {
      const txns = chaseCreditParser.parse(sampleText);
      const apple = txns.find(t => t.description.includes('APPLE.COM'));
      expect(apple).toBeDefined();
      expect(apple!.amount).toBe(-1234.56);
    });

    it('formats dates as ISO 8601', () => {
      const txns = chaseCreditParser.parse(sampleText);
      txns.forEach(t => expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    });

    it('resolves year for December transactions', () => {
      const txns = chaseCreditParser.parse(sampleText);
      const wholeFoods = txns.find(t => t.description.includes('WHOLEFDS'));
      expect(wholeFoods!.date).toBe('2024-12-06');
    });

    it('resolves year for January transactions', () => {
      const txns = chaseCreditParser.parse(sampleText);
      const spotify = txns.find(t => t.description.includes('SPOTIFY'));
      expect(spotify!.date).toBe('2025-01-02');
    });

    it('handles 2-digit year in opening/closing date', () => {
      const text = [
        'opening/closing date 06/05/24 - 07/04/24',
        'PAYMENTS AND OTHER CREDITS',
        '6/15 PAYMENT -500.00',
        'PURCHASE',
        '6/10 SOME STORE 25.00',
        'TOTALS YEAR-TO-DATE',
      ].join('\n');
      const txns = chaseCreditParser.parse(text);
      expect(txns[0].date).toBe('2024-06-15');
      expect(txns[1].date).toBe('2024-06-10');
    });

    it('handles 4-digit year', () => {
      const text = [
        'opening/closing date 06/05/2024 - 07/04/2024',
        'PURCHASE',
        '6/10 STORE 25.00',
        'TOTALS YEAR-TO-DATE',
      ].join('\n');
      const txns = chaseCreditParser.parse(text);
      expect(txns[0].date).toBe('2024-06-10');
    });

    it('stops at TOTALS YEAR-TO-DATE', () => {
      const txns = chaseCreditParser.parse(sampleText);
      const totals = txns.filter(t => t.description.includes('Total'));
      expect(totals).toHaveLength(0);
    });

    it('skips non-transaction lines', () => {
      const txns = chaseCreditParser.parse(sampleText);
      const cardmember = txns.filter(t => t.description.includes('CARDMEMBER'));
      expect(cardmember).toHaveLength(0);
    });

    it('handles page breaks', () => {
      const text = [
        'opening/closing date 12/05/24 - 01/04/25',
        'PURCHASE',
        '12/10 STORE A 50.00',
        '--- PAGE BREAK ---',
        '12/15 STORE B 30.00',
        'TOTALS YEAR-TO-DATE',
      ].join('\n');
      const txns = chaseCreditParser.parse(text);
      expect(txns).toHaveLength(2);
    });

    it('preserves raw line', () => {
      const txns = chaseCreditParser.parse(sampleText);
      const netflix = txns.find(t => t.description.includes('NETFLIX'));
      expect(netflix!.raw).toBe('12/20 NETFLIX.COM 866-579-7172 CA 22.99');
    });

    it('returns empty array when no transaction section', () => {
      expect(chaseCreditParser.parse('some random text')).toHaveLength(0);
    });

    it('handles statement with no payments section', () => {
      const text = [
        'opening/closing date 12/05/24 - 01/04/25',
        'PURCHASES',
        '12/10 STORE A 50.00',
        '12/15 STORE B 30.00',
        'TOTALS YEAR-TO-DATE',
      ].join('\n');
      const txns = chaseCreditParser.parse(text);
      expect(txns).toHaveLength(2);
      expect(txns[0].amount).toBe(-50.00);
      expect(txns[1].amount).toBe(-30.00);
    });

    it('parses single-digit amounts', () => {
      const text = [
        'opening/closing date 06/05/24 - 07/04/24',
        'PURCHASE',
        '6/10 PARKING METER 2',
        'TOTALS YEAR-TO-DATE',
      ].join('\n');
      const txns = chaseCreditParser.parse(text);
      expect(txns).toHaveLength(1);
      expect(txns[0].amount).toBe(-2);
    });
  });
});
