import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import type { Transaction } from '@banksheet/core';

describe('GET /api/parsers', () => {
  it('returns list of available parsers', async () => {
    const res = await request(app).get('/api/parsers');
    expect(res.status).toBe(200);
    expect(res.body.parsers).toBeInstanceOf(Array);
    expect(res.body.parsers.length).toBeGreaterThan(0);
    expect(res.body.parsers[0]).toHaveProperty('name');
    expect(res.body.parsers[0]).toHaveProperty('country');
  });
});

describe('POST /api/parse', () => {
  it('returns 400 when no file uploaded', async () => {
    const res = await request(app).post('/api/parse');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No PDF/i);
  });

  it('returns 422 for non-PDF buffer', async () => {
    const res = await request(app)
      .post('/api/parse')
      .attach('pdf', Buffer.from('not a pdf'), 'fake.pdf');
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /api/export', () => {
  const sampleTransactions: Transaction[] = [
    { date: '2026-01-15', description: 'Test Purchase', amount: -100.50, currency: 'BRL', type: 'debit' },
    { date: '2026-01-20', description: 'Payment Received', amount: 500.00, currency: 'BRL', type: 'credit' },
  ];

  it('returns 400 when transactions missing', async () => {
    const res = await request(app)
      .post('/api/export')
      .send({ format: 'csv' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/transactions/i);
  });

  it('returns 400 for invalid format', async () => {
    const res = await request(app)
      .post('/api/export')
      .send({ transactions: sampleTransactions, format: 'xml' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/format/i);
  });

  it('exports CSV', async () => {
    const res = await request(app)
      .post('/api/export')
      .send({ transactions: sampleTransactions, format: 'csv' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/transactions\.csv/);
    expect(res.text).toContain('date,description,amount,currency,type');
    expect(res.text).toContain('Test Purchase');
  });

  it('exports JSON', async () => {
    const res = await request(app)
      .post('/api/export')
      .send({ transactions: sampleTransactions, format: 'json' });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/transactions\.json/);
    const data = JSON.parse(res.text);
    expect(data).toHaveLength(2);
    expect(data[0].description).toBe('Test Purchase');
  });

  it('exports Excel', async () => {
    const res = await request(app)
      .post('/api/export')
      .send({ transactions: sampleTransactions, format: 'excel' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(res.headers['content-disposition']).toMatch(/transactions\.xlsx/);
    // Binary response — supertest returns it as a Buffer in res.body
    expect(Buffer.isBuffer(res.body) || (typeof res.body === 'object' && res.body !== null)).toBe(true);
  });
});

describe('GET / (static files)', () => {
  it('serves index.html', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('banksheet');
  });
});
