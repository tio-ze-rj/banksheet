import { describe, it, expect } from 'vitest';
import { pcFinancialMastercardParser } from '../index';

describe('pcFinancialMastercardParser', () => {
  describe('detect', () => {
    it('detects President\'s Choice Financial', () => {
      expect(pcFinancialMastercardParser.detect("President's Choice Financial Mastercard®")).toBe(true);
    });

    it('detects Presidents Choice Financial (no apostrophe)', () => {
      expect(pcFinancialMastercardParser.detect('Presidents Choice Financial®')).toBe(true);
    });

    it('detects PC Financial', () => {
      expect(pcFinancialMastercardParser.detect('PC Financial ® online banking')).toBe(true);
    });

    it('detects pcfinancial.ca', () => {
      expect(pcFinancialMastercardParser.detect('visit www.pcfinancial.ca for details')).toBe(true);
    });

    it('detects PC World Mastercard', () => {
      expect(pcFinancialMastercardParser.detect('PC® World Mastercard®')).toBe(true);
    });

    it('detects President\'s Choice Bank', () => {
      expect(pcFinancialMastercardParser.detect("President's Choice Bank is a licensee")).toBe(true);
    });

    it('does not detect unrelated text', () => {
      expect(pcFinancialMastercardParser.detect('Nubank Pagamentos')).toBe(false);
    });
  });

  describe('parse', () => {
    const sampleText = [
      'Account summary',
      'XXXX XXXX XX44 8830',
      'Previous Balance $1,581.07',
      'Statement details',
      "President's Choice Financial Mastercard®",
      'MISS SYLVIA H DE ANTONIO',
      'Statement date: Feb. 19, 2026',
      'Statement balance: $1,827.51 Statement period: Jan. 20, 2026 - Feb. 19, 2026',
      'Transaction',
      'date',
      'dd/mm',
      'Posting',
      'date',
      'dd/mm Account activity Amount',
      'XXXX XXXX XX44 8830',
      '10/02 11/02 PAYMENT RBC -$1,581.00',
      'Total payment activity -$1,581.00',
      '18/01 20/01 COINAMATIC TORONTO ON $40.25',
      '20/01 21/01 AMAZON CHANNELS VANCOUVER BC $5.64',
      '20/01 22/01 ST. LOUIS BAR & GRILL NORTH YORK ON $25.59',
      '21/01 22/01 AMZN MKTP CA TORONTO ON -$19.44',
      '21/01 22/01 COSTCO WHOLESALE W1316 EAST YORK ON $235.83',
      '21/01 22/01 DOLLARAMA # 911 TORONTO ON $11.97',
      '21/01 22/01 HEALTHY PLANET STOCKYA TORONTO ON $77.25',
      '21/01 22/01 RALLY AUTO TORONTO ON $113.00',
      '21/01 23/01 MCDONALD\'S #23469 TORONTO ON $5.65',
      '22/01 23/01 AMAZON.CA PRIME MEMBER VANCOUVER BC $11.29',
      '22/01 23/01 SHOPPERS DRUG MART #60 EAST YORK ON $57.59',
      '--- PAGE BREAK ---',
      'MISS SYLVIA H DE ANTONIO - XXXX XXXX XX44 8830',
      'Statement details continued Page 2 of 3',
      'Presidents Choice Financial®',
      'PC® World Mastercard®',
      'Transaction',
      'date',
      'dd/mm',
      'Posting',
      'date',
      'dd/mm Account activity Amount',
      '23/01 26/01 ULTRAMAR # 51734 TORONTO ON $59.33',
      '23/01 26/01 RCSS 1077 TORONTO ON $76.74',
      '23/01 26/01 CONGEE QUEEN TORONTO ON $72.45',
      '27/01 28/01 UNIQLO FAIRVIEW MALL TORONTO ON $67.47',
      '27/01 28/01 COSTCO WHOLESALE W1316 EAST YORK ON $164.96',
      '31/01 02/02 RCSS 1077 TORONTO ON $60.60',
      '01/02 02/02 EPIC PARKING CONTROL S MISSISSAUGA ON $5.65',
      '02/02 02/02 SQ *LOCAL LEASIDE EAST YORK ON $41.67',
      '02/02 03/02 AMZN MKTP CA*M12A65773 TORONTO ON $37.55',
      '02/02 03/02 AMZN MKTP CA*7M47824N3 TORONTO ON $23.72',
      '02/02 03/02 BELL CANADA (OB) MONTREAL QC $129.95',
      '02/02 03/02 PURE FITNESS TORONTO ON $77.97',
      '04/02 05/02 COSTCO WHOLESALE W1316 EAST YORK ON $70.98',
      '04/02 06/02 MILLWOOD ESSO TORONTO ON $16.94',
      '04/02 06/02 MCDONALD\'S #40397 BRAMPTON ON $10.03',
      '06/02 09/02 CRAVE ON EGLINTON TORONTO ON $45.46',
      '07/02 09/02 ULTRAMAR # 51734 TORONTO ON $60.83',
      '08/02 10/02 COINAMATIC TORONTO ON $20.25',
      '14/02 16/02 ELEVENLABS.IO NEW YORK NY USD',
      '5.65 USA 1.398230088 $7.90',
      '14/02 16/02 ELEVENLABS.IO NEW YORK NY USD',
      '12.43 USA 1.397425583 $17.37',
      '15/02 16/02 CHIPOTLE #2142 TORONTO ON $21.19',
      '18/02 19/02 COSTCO WHOLESALE W1316 EAST YORK ON $128.92',
      '18/02 19/02 COSTCO WHOLESALE W1316 EAST YORK ON $4.62',
      '19/02 19/02 PURCHASE INTEREST CHARGE $40.27',
      '--- PAGE BREAK ---',
      'Interest rates',
      'Purchases $40.27 21.99 % 0.06024 %',
    ].join('\n');

    it('parses all transactions', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      // 1 payment + 11 page1 + 18 page2 + 2 foreign + 3 remaining + 1 interest = 36
      expect(txns).toHaveLength(36);
    });

    it('all transactions have CAD currency', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      txns.forEach(t => expect(t.currency).toBe('CAD'));
    });

    it('parses payment as credit with positive amount', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      const payment = txns.find(t => t.description.includes('PAYMENT RBC'));
      expect(payment).toBeDefined();
      expect(payment!.amount).toBe(1581);
      expect(payment!.type).toBe('credit');
      expect(payment!.date).toBe('2026-02-10');
    });

    it('parses purchase as debit with negative amount', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      const costco = txns.find(t => t.description.includes('COSTCO WHOLESALE') && t.date === '2026-01-21');
      expect(costco).toBeDefined();
      expect(costco!.amount).toBe(-235.83);
      expect(costco!.type).toBe('debit');
    });

    it('parses refund as credit with positive amount', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      const refund = txns.find(t => t.description.includes('AMZN MKTP CA') && t.amount > 0 && t.date === '2026-01-21');
      expect(refund).toBeDefined();
      expect(refund!.amount).toBe(19.44);
      expect(refund!.type).toBe('credit');
    });

    it('parses foreign currency transaction with CAD amount', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      const eleven = txns.filter(t => t.description.includes('ELEVENLABS.IO'));
      expect(eleven).toHaveLength(2);
      expect(eleven[0].amount).toBe(-7.90);
      expect(eleven[1].amount).toBe(-17.37);
      expect(eleven[0].date).toBe('2026-02-14');
    });

    it('parses foreign currency refund as credit', () => {
      const refundText = [
        'Statement date: Feb. 19, 2026',
        'dd/mm Account activity Amount',
        '14/02 16/02 SOME FOREIGN STORE NEW YORK NY USD',
        '5.65 USA 1.398230088 -$7.90',
        'Interest rates',
      ].join('\n');
      const txns = pcFinancialMastercardParser.parse(refundText);
      expect(txns).toHaveLength(1);
      expect(txns[0].amount).toBe(7.90);
      expect(txns[0].type).toBe('credit');
    });

    it('parses interest charge as debit', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      const interest = txns.find(t => t.description.includes('PURCHASE INTEREST CHARGE'));
      expect(interest).toBeDefined();
      expect(interest!.amount).toBe(-40.27);
      expect(interest!.type).toBe('debit');
    });

    it('formats dates as ISO 8601', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      txns.forEach(t => expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    });

    it('resolves year correctly — all January/February transactions get 2026', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      txns.forEach(t => {
        expect(t.date.startsWith('2026-')).toBe(true);
      });
    });

    it('handles year rollover for months after statement month', () => {
      const rolloverText = [
        'Statement date: Jan. 15, 2026',
        'dd/mm Account activity Amount',
        '15/12 16/12 DECEMBER PURCHASE TORONTO ON $50.00',
        '02/01 03/01 JANUARY PURCHASE TORONTO ON $30.00',
        'Interest rates',
      ].join('\n');
      const txns = pcFinancialMastercardParser.parse(rolloverText);
      expect(txns).toHaveLength(2);
      expect(txns[0].date).toBe('2025-12-15');
      expect(txns[1].date).toBe('2026-01-02');
    });

    it('skips Total payment activity line', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      const totals = txns.filter(t => t.description.includes('Total'));
      expect(totals).toHaveLength(0);
    });

    it('handles page breaks within transaction section', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      // Transactions from both page 1 and page 2 should be present
      const ultramar = txns.find(t => t.description.includes('ULTRAMAR'));
      expect(ultramar).toBeDefined();
    });

    it('stops at Interest rates section', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      const interestTable = txns.filter(t => t.description.includes('21.99'));
      expect(interestTable).toHaveLength(0);
    });

    it('preserves raw line', () => {
      const txns = pcFinancialMastercardParser.parse(sampleText);
      const coinamatic = txns.find(t => t.description.includes('COINAMATIC') && t.date === '2026-01-18');
      expect(coinamatic!.raw).toBe('18/01 20/01 COINAMATIC TORONTO ON $40.25');
    });

    it('returns empty array when no transaction section', () => {
      expect(pcFinancialMastercardParser.parse('some random text')).toHaveLength(0);
    });

    it('parses Statement period when Statement date is absent', () => {
      const periodOnly = [
        'Statement period: Dec. 20, 2025 - Jan. 19, 2026',
        'dd/mm Account activity Amount',
        '05/01 06/01 SOME STORE TORONTO ON $25.00',
        'Interest rates',
      ].join('\n');
      const txns = pcFinancialMastercardParser.parse(periodOnly);
      expect(txns).toHaveLength(1);
      expect(txns[0].date).toBe('2026-01-05');
    });
  });
});
