// Database enums as union types
export type TxType = 'buy' | 'sell' | 'dividend' | 'switch_in' | 'switch_out';
export type DividendType = 'cash' | 'reinvest';

// Database row types
export interface Fund {
  id: string;
  fund_code: string;
  fund_name: string;
  amc_name: string;
  category: string | null;
  asset_class: string | null;
  risk_level: number | null;
  sec_fund_code: string | null;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  fund_id: string;
  tx_type: TxType;
  trade_date: string;
  units: number;
  amount: number;
  nav_at_trade: number;
  fee: number;
  note: string | null;
  dividend_type: DividendType | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithFund extends Transaction {
  funds: Fund;
}

export interface NavHistory {
  id: string;
  fund_id: string;
  nav_date: string;
  nav_per_unit: number;
  fetched_at: string | null;
  source: string | null;
  updated_at: string;
}

export interface PortfolioSnapshot {
  id: string;
  snapshot_date: string;
  total_value: number;
  total_cost: number;
  total_gain_loss: number;
  total_return_percent: number;
  latest_nav_date: string | null;
  created_at: string;
  /** Net external cash flow on this snapshot date only (buys/switch_in/reinvest minus sells/switch_out). Not carried forward. */
  net_flow?: number;
  has_transaction?: boolean;
  tx_count?: number;
}

// Computed types
export type ValuationStatus = 'ready' | 'waiting_for_nav' | 'nav_unavailable';

export interface Holding {
  fund: Fund;
  total_units: number;
  total_cost: number;
  avg_cost: number;
  latest_nav: number;
  market_value: number;
  gain_loss: number;
  return_pct: number;
  allocation_pct: number;
  valuation_status: ValuationStatus;
}

export interface PerformanceReturn {
  period: string;
  return_pct: number | null;
}

export type ChartRange = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'SINCE_START';
