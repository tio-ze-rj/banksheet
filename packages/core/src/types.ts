/** Single parsed transaction from a bank statement */
export interface Transaction {
  date: string;            // ISO 8601: YYYY-MM-DD
  description: string;
  amount: number;          // Positive = income, negative = expense
  currency: string;        // ISO 4217: USD, BRL, EUR
  type: 'credit' | 'debit';
  category?: string;
  raw?: string;            // Original line from PDF (debugging)
}

/** Plugin interface — one per bank */
export interface BankParser {
  name: string;            // "Itaú Cartão", "Nubank", "Chase"
  country: string;         // ISO 3166-1 alpha-2: BR, US, GB
  detect(text: string): boolean;
  parse(text: string): Transaction[];
}

/** Export configuration */
export interface ExportOptions {
  format: 'csv' | 'excel' | 'json';
  output?: string;
  currency?: string;
  dateFormat?: string;
}

/** Result of parsing a statement */
export interface ParseResult {
  bank: string;
  transactions: Transaction[];
  total: number;
  currency: string;
}
