import { describe, it, expect, vi } from 'vitest';
import { parseStatement } from '../../index';
import { plugins } from '../../plugins/index';

// pdfjs-dist requires real PDFs, so we mock it for unit tests.
// The mock returns the buffer content as text (skipping the header).
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: vi.fn((params: { data: Uint8Array; password?: string }) => {
    const text = Buffer.from(params.data).toString('utf-8');
    if (text.length === 0) throw new Error('Empty buffer');
    return {
      promise: Promise.resolve({
        numPages: 1,
        getPage: () => Promise.resolve({
          getTextContent: () => Promise.resolve({
            items: [{ str: text, hasEOL: true }],
          }),
        }),
      }),
    };
  }),
}));

describe('PDF Extraction Integration', () => {
  it('extractText returns text from PDF buffer', async () => {
    const { extractText } = await import('../../parser');
    const fakeContent = 'ITAUUNIBANCOHOLDINGS.A.\n03/01TESTSTORE100,00';
    const fakePdf = Buffer.from(fakeContent);
    const text = await extractText(fakePdf);
    expect(text).toContain('ITAUUNIBANCO');
  });

  it('extractText accepts optional password', async () => {
    const { extractText } = await import('../../parser');
    const fakePdf = Buffer.from('ITAUUNIBANCO test');
    const text = await extractText(fakePdf, 'secret123');
    expect(text).toContain('ITAUUNIBANCO');
  });

  it('full pipeline: extracted text -> parse -> transactions', () => {
    const text = `
ITAUUNIBANCOHOLDINGS.A.
03/01SUPERMERCADOEXTRA150,00
03/02UBER*TRIP25,50
`;
    const result = parseStatement(text, plugins);
    expect(result.bank).toBe('Itaú Cartão');
    expect(result.transactions.length).toBe(2);
    expect(result.transactions[0].amount).toBe(-150);
    expect(result.transactions[1].amount).toBe(-25.5);
  });

  it('rejects empty buffer via extractText', async () => {
    const { extractText } = await import('../../parser');
    await expect(extractText(Buffer.from(''))).rejects.toThrow();
  });
});
