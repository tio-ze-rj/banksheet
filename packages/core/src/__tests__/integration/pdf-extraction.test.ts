import { describe, it, expect, vi } from 'vitest';
import { parseStatement } from '../../index';
import { plugins } from '../../plugins/index';

// pdf-parse uses a very old pdfjs (1.10) that can't read PDFs generated
// by modern libraries (pdfkit, pdf-lib). Instead of fighting compatibility,
// we test extractText behavior via mocking and test the full text→parse
// pipeline with real text.

vi.mock('pdf-parse', () => ({
  default: vi.fn(async (buffer: Buffer) => {
    if (buffer.length === 0) throw new Error('Empty buffer');
    const text = buffer.toString();
    if (!text.startsWith('%PDF') && !text.includes('MOCK_PDF')) {
      throw new Error('Invalid PDF');
    }
    return { text: buffer.toString('utf-8', 8) }; // skip header
  }),
}));

describe('PDF Extraction Integration', () => {
  it('extractText returns text from PDF buffer', async () => {
    // Import after mock is set up
    const { extractText } = await import('../../parser');
    const fakeContent = 'ITAUUNIBANCOHOLDINGS.A.\n03/01TESTSTORE100,00';
    const fakePdf = Buffer.from('MOCK_PDF' + fakeContent);
    const text = await extractText(fakePdf);
    expect(text).toContain('ITAUUNIBANCO');
  });

  it('full pipeline: extracted text → parse → transactions', () => {
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
