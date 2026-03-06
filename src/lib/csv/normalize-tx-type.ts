import type { TxType, DividendType } from '@/types/portfolio';

const TX_TYPE_MAP: Record<string, TxType> = {
  buy: 'buy',
  purchase: 'buy',
  sell: 'sell',
  sale: 'sell',
  redeem: 'sell',
  redemption: 'sell',
  dividend: 'dividend',
  div: 'dividend',
  income: 'dividend',
  distribution: 'dividend',
  'switch in': 'switch_in',
  'switch_in': 'switch_in',
  switchin: 'switch_in',
  'transfer in': 'switch_in',
  'switch out': 'switch_out',
  'switch_out': 'switch_out',
  switchout: 'switch_out',
  'transfer out': 'switch_out',
};

const DIVIDEND_TYPE_MAP: Record<string, DividendType> = {
  cash: 'cash',
  reinvest: 'reinvest',
  reinvestment: 'reinvest',
  drip: 'reinvest',
};

export function normalizeTxType(raw: string | null | undefined): TxType | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return TX_TYPE_MAP[key] ?? null;
}

export function normalizeDividendType(raw: string | null | undefined): DividendType | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return DIVIDEND_TYPE_MAP[key] ?? null;
}
