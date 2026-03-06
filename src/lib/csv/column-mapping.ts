export interface AppField {
  key: string;
  label: string;
  required: boolean;
}

export const APP_FIELDS: AppField[] = [
  { key: 'fund_code', label: 'Fund Code', required: true },
  { key: 'tx_type', label: 'Transaction Type', required: true },
  { key: 'trade_date', label: 'Trade Date', required: true },
  { key: 'units', label: 'Units', required: true },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'nav_at_trade', label: 'NAV at Trade', required: true },
  { key: 'fee', label: 'Fee', required: false },
  { key: 'note', label: 'Note', required: false },
  { key: 'dividend_type', label: 'Dividend Type', required: false },
];

/** Maps normalized synonym → app field key */
const HEADER_SYNONYMS: Record<string, string> = {
  // fund_code
  fund_code: 'fund_code',
  fund: 'fund_code',
  ticker: 'fund_code',
  symbol: 'fund_code',
  code: 'fund_code',
  'fund code': 'fund_code',
  'fund name': 'fund_code',
  // tx_type
  tx_type: 'tx_type',
  type: 'tx_type',
  action: 'tx_type',
  'transaction type': 'tx_type',
  transaction: 'tx_type',
  // trade_date
  trade_date: 'trade_date',
  date: 'trade_date',
  'trade date': 'trade_date',
  'transaction date': 'trade_date',
  // units
  units: 'units',
  quantity: 'units',
  qty: 'units',
  shares: 'units',
  // amount
  amount: 'amount',
  total: 'amount',
  value: 'amount',
  'total amount': 'amount',
  // nav_at_trade
  nav_at_trade: 'nav_at_trade',
  nav: 'nav_at_trade',
  price: 'nav_at_trade',
  'nav at trade': 'nav_at_trade',
  'unit price': 'nav_at_trade',
  // fee
  fee: 'fee',
  commission: 'fee',
  charges: 'fee',
  // note
  note: 'note',
  notes: 'note',
  comment: 'note',
  remarks: 'note',
  // dividend_type
  dividend_type: 'dividend_type',
  'dividend type': 'dividend_type',
  'div type': 'dividend_type',
};

/**
 * Auto-detect column mapping from CSV headers.
 * Returns { appFieldKey → csvHeader }
 */
export function autoDetectMapping(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  for (const csvHeader of csvHeaders) {
    const normalized = csvHeader.trim().toLowerCase().replace(/[_\-]/g, ' ');
    const appKey = HEADER_SYNONYMS[normalized];
    if (appKey && !mapping[appKey]) {
      mapping[appKey] = csvHeader;
      usedHeaders.add(csvHeader);
    }
  }

  return mapping;
}
