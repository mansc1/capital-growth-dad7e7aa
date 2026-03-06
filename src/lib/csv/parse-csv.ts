import Papa from 'papaparse';

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        resolve({
          headers: results.meta.fields ?? [],
          rows: results.data,
        });
      },
      error: (err) => reject(err),
    });
  });
}

const TEMPLATE_HEADERS = [
  'fund_code',
  'tx_type',
  'trade_date',
  'units',
  'amount',
  'nav_at_trade',
  'fee',
  'note',
  'dividend_type',
];

const TEMPLATE_EXAMPLE = [
  'KFLTFDIV',
  'buy',
  '2025-01-15',
  '100.5000',
  '10050.00',
  '100.00',
  '0',
  'Initial purchase',
  '',
];

export function generateCsvTemplate(): string {
  return [TEMPLATE_HEADERS.join(','), TEMPLATE_EXAMPLE.join(',')].join('\n');
}

export function downloadCsvTemplate() {
  const csv = generateCsvTemplate();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transaction_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}
