import type { PortfolioSnapshot, NavHistory } from '@/types/portfolio';
import { subMonths } from 'date-fns';

/**
 * Compute Time-Weighted Return (TWR) for the portfolio from snapshots.
 * TWR = product(1 + daily_return) - 1
 * where daily_return = (value_today / value_yesterday) - 1
 */
export function computePortfolioTWR(
  snapshots: PortfolioSnapshot[],
  startDate?: string,
  endDate?: string
): { totalReturnPct: number } {
  if (!snapshots || snapshots.length < 2) {
    return { totalReturnPct: 0 };
  }

  // Filter to date range
  let filtered = snapshots
    .slice()
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  if (startDate) {
    filtered = filtered.filter((s) => s.snapshot_date >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter((s) => s.snapshot_date <= endDate);
  }

  if (filtered.length < 2) {
    return { totalReturnPct: 0 };
  }

  let product = 1;
  for (let i = 1; i < filtered.length; i++) {
    const prevValue = Number(filtered[i - 1].total_value);
    const currValue = Number(filtered[i].total_value);
    if (prevValue > 0) {
      const dailyReturn = currValue / prevValue - 1;
      product *= 1 + dailyReturn;
    }
  }

  return { totalReturnPct: (product - 1) * 100 };
}

/**
 * Compute TWR for a specific period using chart range.
 */
export function computePortfolioTWRForRange(
  snapshots: PortfolioSnapshot[],
  range: '1M' | '3M' | 'ALL'
): { totalReturnPct: number } {
  const now = new Date();
  let startDate: string | undefined;

  if (range === '1M') {
    startDate = subMonths(now, 1).toISOString().split('T')[0];
  } else if (range === '3M') {
    startDate = subMonths(now, 3).toISOString().split('T')[0];
  }

  return computePortfolioTWR(snapshots, startDate);
}

/**
 * Compute fund-level return from NAV history (NAV-based TWR).
 * fund_return = (NAV_last / NAV_first) - 1
 */
export function computeFundReturn(
  navHistory: NavHistory[],
  startDate?: string,
  endDate?: string
): { returnPct: number | null } {
  if (!navHistory || navHistory.length === 0) {
    return { returnPct: null };
  }

  let filtered = navHistory
    .slice()
    .sort((a, b) => a.nav_date.localeCompare(b.nav_date));

  if (startDate) {
    filtered = filtered.filter((n) => n.nav_date >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter((n) => n.nav_date <= endDate);
  }

  if (filtered.length < 2) {
    return { returnPct: null };
  }

  const firstNav = Number(filtered[0].nav_per_unit);
  const lastNav = Number(filtered[filtered.length - 1].nav_per_unit);

  if (firstNav <= 0) {
    return { returnPct: null };
  }

  return { returnPct: ((lastNav / firstNav) - 1) * 100 };
}

/**
 * Compute fund returns for standard periods: 1M, 3M, Since First Buy.
 */
export function computeFundReturnPeriods(
  navHistory: NavHistory[],
  firstBuyDate?: string
): { label: string; value: number | null }[] {
  const now = new Date();
  const date1m = subMonths(now, 1).toISOString().split('T')[0];
  const date3m = subMonths(now, 3).toISOString().split('T')[0];

  return [
    { label: '1M', value: computeFundReturn(navHistory, date1m).returnPct },
    { label: '3M', value: computeFundReturn(navHistory, date3m).returnPct },
    {
      label: 'Since First Buy',
      value: computeFundReturn(navHistory, firstBuyDate).returnPct,
    },
  ];
}

/**
 * Compute daily returns from snapshots for chart tooltip enhancement.
 * Returns a map of snapshot_date -> daily_return_pct
 */
export function computeDailyReturns(
  snapshots: PortfolioSnapshot[]
): Map<string, number> {
  const sorted = snapshots
    .slice()
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  const map = new Map<string, number>();

  for (let i = 1; i < sorted.length; i++) {
    const prevValue = Number(sorted[i - 1].total_value);
    const currValue = Number(sorted[i].total_value);
    if (prevValue > 0) {
      map.set(sorted[i].snapshot_date, ((currValue / prevValue) - 1) * 100);
    }
  }

  return map;
}
