import pdfParse from 'pdf-parse';
import type { BankParser, ParseResult } from './types';

/** Extract raw text from a PDF buffer */
export async function extractText(pdfBuffer: Buffer): Promise<string> {
  const result = await pdfParse(pdfBuffer);
  return result.text;
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
