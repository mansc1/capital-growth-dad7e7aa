import type { TxType, DividendType, Fund, TransactionWithFund } from '@/types/portfolio';
import { normalizeTxType, normalizeDividendType } from './normalize-tx-type';

export type RowStatus = 'valid' | 'warning' | 'invalid' | 'duplicate';

export interface ParsedRow {
  fund_code: string;
  tx_type: TxType;
  trade_date: string;
  units: number | null;
  amount: number | null;
  nav_at_trade: number | null;
  fee: number | null;
  note: string | null;
  dividend_type: DividendType | null;
}

export interface ValidatedRow {
  rowIndex: number;
  status: RowStatus;
  errors: string[];
  warnings: string[];
  parsed: ParsedRow | null;
  resolvedFundId: string | null;
  rawFundCode: string;
}

const NORM = (s: string | null | undefined): string => s?.trim().toUpperCase() ?? '';

/** Parse YYYY-MM-DD or DD/MM/YYYY only. Returns YYYY-MM-DD or null. */
function parseDate(raw: string): string | null {
  const trimmed = raw.trim();

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (isValidDate(+y, +m, +d)) return `${y}-${m}-${d}`;
    return null;
  }

  // DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    if (isValidDate(+y, +m, +d)) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return null;
  }

  return null;
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Parse number, stripping commas. Returns null for empty/missing. */
function parseNum(raw: string | null | undefined): number | null {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.trim().replace(/,/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

/** Null-safe composite key for duplicate detection. */
function generateDuplicateKey(
  fundId: string | null,
  txType: string | null,
  tradeDate: string | null,
  amount: number | null | undefined,
  units: number | null | undefined,
  nav: number | null | undefined,
): string {
  const safe = (v: unknown): string => (v != null && v !== '' ? String(v) : '');
  return [safe(fundId), safe(txType), safe(tradeDate), safe(amount), safe(units), safe(nav)].join('|');
}

export function validateRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string>,
  existingFunds: Fund[],
  existingTransactions: TransactionWithFund[],
): ValidatedRow[] {
  // Build fund lookup maps using consistent NORM
  const fundBySecCode = new Map<string, Fund>();
  const fundByCode = new Map<string, Fund>();
  for (const f of existingFunds) {
    const secNorm = NORM(f.sec_fund_code);
    if (secNorm) fundBySecCode.set(secNorm, f);
    fundByCode.set(NORM(f.fund_code), f);
  }

  // Build existing transaction duplicate keys
  const existingKeys = new Set<string>();
  for (const tx of existingTransactions) {
    existingKeys.add(
      generateDuplicateKey(tx.fund_id, tx.tx_type, tx.trade_date, tx.amount, tx.units, tx.nav_at_trade),
    );
  }

  const batchKeys = new Set<string>();
  const results: ValidatedRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract raw values via mapping
    const rawFundCode = row[mapping.fund_code] ?? '';
    const rawTxType = row[mapping.tx_type] ?? '';
    const rawDate = row[mapping.trade_date] ?? '';
    const rawUnits = row[mapping.units] ?? '';
    const rawAmount = row[mapping.amount] ?? '';
    const rawNav = row[mapping.nav_at_trade] ?? '';
    const rawFee = mapping.fee ? row[mapping.fee] ?? '' : '';
    const rawNote = mapping.note ? row[mapping.note] ?? '' : '';
    const rawDividendType = mapping.dividend_type ? row[mapping.dividend_type] ?? '' : '';

    // Fund resolution
    const normCode = NORM(rawFundCode);
    let resolvedFundId: string | null = null;
    if (!normCode) {
      errors.push('Fund code is required');
    } else {
      const fund = fundBySecCode.get(normCode) ?? fundByCode.get(normCode);
      if (fund) {
        resolvedFundId = fund.id;
      } else {
        warnings.push(`Fund "${rawFundCode}" not found — will attempt SEC directory lookup`);
      }
    }

    // Type
    const txType = normalizeTxType(rawTxType);
    if (!txType) errors.push(`Invalid transaction type "${rawTxType}"`);

    // Date
    const tradeDate = parseDate(rawDate);
    if (!rawDate.trim()) {
      errors.push('Trade date is required');
    } else if (!tradeDate) {
      errors.push(`Unsupported date format "${rawDate}" — use YYYY-MM-DD or DD/MM/YYYY`);
    }

    // Numbers
    const units = parseNum(rawUnits);
    const amount = parseNum(rawAmount);
    const navAtTrade = parseNum(rawNav);
    const fee = parseNum(rawFee);
    const note = rawNote.trim() || null;
    const dividendType = normalizeDividendType(rawDividendType);

    // Numeric parse errors
    if (rawUnits.trim() && units === null) errors.push(`Invalid units value "${rawUnits}"`);
    if (rawAmount.trim() && amount === null) errors.push(`Invalid amount value "${rawAmount}"`);
    if (rawNav.trim() && navAtTrade === null) errors.push(`Invalid NAV value "${rawNav}"`);
    if (rawFee.trim() && fee === null) errors.push(`Invalid fee value "${rawFee}"`);

    // Type-specific validation
    if (txType && errors.length === 0) {
      if (txType === 'buy' || txType === 'switch_in') {
        const hasAmount = amount != null && amount > 0;
        const hasUnitsAndNav = units != null && units > 0 && navAtTrade != null && navAtTrade > 0;
        if (!hasAmount && !hasUnitsAndNav) {
          errors.push('Buy/Switch-in requires amount > 0, or both units > 0 and NAV > 0');
        }
      } else if (txType === 'sell' || txType === 'switch_out') {
        if (units == null || units <= 0) {
          errors.push('Sell/Switch-out requires units > 0');
        }
      } else if (txType === 'dividend') {
        if ((amount == null || amount <= 0) && (units == null || units <= 0)) {
          errors.push('Dividend requires amount > 0 or units > 0');
        }
      }
    }

    // Build parsed row
    const parsed: ParsedRow | null = errors.length === 0 && txType && tradeDate
      ? {
          fund_code: rawFundCode.trim(),
          tx_type: txType,
          trade_date: tradeDate,
          units,
          amount,
          nav_at_trade: navAtTrade,
          fee,
          note,
          dividend_type: txType === 'dividend' ? dividendType : null,
        }
      : null;

    // Determine status
    let status: RowStatus;
    if (errors.length > 0) {
      status = 'invalid';
    } else if (warnings.length > 0) {
      status = 'warning';
    } else {
      status = 'valid';
    }

    // Duplicate check for valid/warning rows with resolved fund
    if ((status === 'valid' || status === 'warning') && resolvedFundId && parsed) {
      const key = generateDuplicateKey(
        resolvedFundId,
        parsed.tx_type,
        parsed.trade_date,
        parsed.amount,
        parsed.units,
        parsed.nav_at_trade,
      );
      if (existingKeys.has(key) || batchKeys.has(key)) {
        status = 'duplicate';
      } else {
        batchKeys.add(key);
      }
    }

    results.push({
      rowIndex: i,
      status,
      errors,
      warnings,
      parsed,
      resolvedFundId,
      rawFundCode: rawFundCode.trim(),
    });
  }

  return results;
}
