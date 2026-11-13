/** Single parsed transaction from a bank statement */
export interface Transaction {
  date: string;            // ISO 8601: YYYY-MM-DD
  description: string;
  amount: number;          // Positive = income, negative = expense
  currency: string;        // ISO 4217: USD, BRL, EUR
  type: 'credit' | 'debit';
  category?: string;
  raw?: string;            // Original line from PDF (debugging)

  // Optional fields for importers (e.g. Firefly III). Parsers set them when the
  // statement provides the information; the JSON export includes them.
  account?: string;        // Account the statement line belongs to
  counterAccount?: string; // Other own account involved (transfers, card payments)
  payee?: string;          // Merchant / counterparty that is not an own account
  externalId?: string;     // Stable, unique-per-line ID (for duplicate detection)
  bookingDate?: string;    // ISO 8601: posting date, when different from `date`
  exchangeRate?: number;   // Rate used for foreign-currency purchases
  notes?: string;          // Extra free-text detail that does not belong in the description
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
