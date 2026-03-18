import type { BankParser, ParseResult } from './types';

// Cache the dynamic import so it only resolves once
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsPromise: Promise<any> | undefined;

function getPdfjsLib() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsPromise;
}

/** Extract raw text from a PDF buffer */
export async function extractText(pdfBuffer: Buffer, password?: string): Promise<string> {
  const pdfjsLib = await getPdfjsLib();

  const params: Record<string, unknown> = {
    data: new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength),
    useSystemFonts: true,
  };
  if (password) {
    params.password = password;
  }

  const doc = await pdfjsLib.getDocument(params).promise;

  // Extract all pages in parallel
  const pagePromises = Array.from({ length: doc.numPages }, async (_, idx) => {
    const page = await doc.getPage(idx + 1);
    const content = await page.getTextContent();
    return (content.items as Array<{ str: string; hasEOL?: boolean }>)
      .filter(item => 'str' in item)
      .map(item => item.str + (item.hasEOL ? '\n' : ''))
      .join('');
  });

  const pages = await Promise.all(pagePromises);
  return pages.join('\n--- PAGE BREAK ---\n');
}

/** Parse statement text using available plugins */
export function parseStatement(
  text: string,
  parsers: BankParser[],
  bankName?: string,
): ParseResult {
  let parser: BankParser | undefined;

  if (bankName) {
    parser = parsers.find(
      p => p.name.toLowerCase() === bankName.toLowerCase(),
    );
    if (!parser) {
      throw new Error(`Parser not found: ${bankName}`);
    }
  } else {
    parser = parsers.find(p => p.detect(text));
    if (!parser) {
      throw new Error(
        'No parser detected for this statement. Use --bank to specify manually.',
      );
    }
  }

  const transactions = parser.parse(text);
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  const currency = transactions[0]?.currency ?? 'USD';

  return {
    bank: parser.name,
    transactions,
    total,
    currency,
  };
}
