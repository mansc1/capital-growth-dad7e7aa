import type { PortfolioSnapshot, NavHistory, ChartRange } from '@/types/portfolio';
import { subMonths } from 'date-fns';
import { rangeToStartDate } from '@/lib/chart-range';

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
      const flow = filtered[i].net_flow ?? 0;
      const dailyReturn = (currValue - flow - prevValue) / prevValue;
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
  range: ChartRange
): { totalReturnPct: number } {
  const startDate = rangeToStartDate(range) ?? undefined;
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
      const flow = sorted[i].net_flow ?? 0;
      map.set(sorted[i].snapshot_date, ((currValue - flow - prevValue) / prevValue) * 100);
    }
  }

  return map;
}

/**
 * Compute cumulative portfolio TWR time series from snapshots.
 */
export interface TWRSeriesPoint {
  date: string;
  twrPct: number;
  value: number;
  dailyReturnPct: number;
}

export function computePortfolioTWRSeries(
  snapshots: PortfolioSnapshot[],
  startDate?: string
): TWRSeriesPoint[] {
  let sorted = snapshots
    .slice()
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  if (startDate) {
    sorted = sorted.filter((s) => s.snapshot_date >= startDate);
  }

  if (sorted.length < 2) return [];

  const result: TWRSeriesPoint[] = [
    { date: sorted[0].snapshot_date, twrPct: 0, value: Number(sorted[0].total_value), dailyReturnPct: 0 },
  ];

  let product = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prevValue = Number(sorted[i - 1].total_value);
    const currValue = Number(sorted[i].total_value);
    const flow = sorted[i].net_flow ?? 0;
    const dailyReturn = prevValue > 0 ? (currValue - flow - prevValue) / prevValue : 0;
    product *= 1 + dailyReturn;
    result.push({
      date: sorted[i].snapshot_date,
      twrPct: (product - 1) * 100,
      value: currValue,
      dailyReturnPct: dailyReturn * 100,
    });
  }

  return result;
}

/**
 * Compute normalized fund return series for multiple funds.
 * Each fund is normalized from its first NAV in the range: (NAV/NAV_start - 1) * 100
 */
export interface FundReturnSeriesResult {
  data: Record<string, number | string>[];
  fundCodes: string[];
}

export function computeFundReturnSeries(
  navHistory: NavHistory[],
  heldFundIds: Set<string>,
  fundIdToCode: Map<string, string>,
  startDate?: string,
  fundFirstTxDate?: Map<string, string>
): FundReturnSeriesResult {
  // Group NAV by fund_id, filter to held funds only
  const byFund = new Map<string, { date: string; nav: number }[]>();

  for (const row of navHistory) {
    if (!heldFundIds.has(row.fund_id)) continue;
    if (startDate && row.nav_date < startDate) continue;
    // Skip NAV points before this fund's first transaction
    const firstTx = fundFirstTxDate?.get(row.fund_id);
    if (firstTx && row.nav_date < firstTx) continue;

    if (!byFund.has(row.fund_id)) byFund.set(row.fund_id, []);
    byFund.get(row.fund_id)!.push({ date: row.nav_date, nav: Number(row.nav_per_unit) });
  }

  // Normalize each fund from first NAV, skip funds with < 2 points
  const fundSeries = new Map<string, Map<string, number>>();
  const validFundCodes: string[] = [];

  for (const [fundId, points] of byFund) {
    if (points.length < 2) continue;
    const code = fundIdToCode.get(fundId);
    if (!code) continue;

    points.sort((a, b) => a.date.localeCompare(b.date));
    const startNav = points[0].nav;
    if (startNav <= 0) continue;

    const series = new Map<string, number>();
    for (const p of points) {
      series.set(p.date, ((p.nav / startNav) - 1) * 100);
    }
    fundSeries.set(code, series);
    validFundCodes.push(code);
  }

  validFundCodes.sort();

  // Collect all unique dates
  const allDates = new Set<string>();
  for (const series of fundSeries.values()) {
    for (const date of series.keys()) allDates.add(date);
  }

  const sortedDates = [...allDates].sort();

  // Build merged rows — carry forward last known value for each fund
  const lastKnown = new Map<string, number>();
  const data: Record<string, number | string>[] = sortedDates.map((date) => {
    const row: Record<string, number | string> = { date };
    for (const code of validFundCodes) {
      const series = fundSeries.get(code)!;
      if (series.has(date)) {
        const val = series.get(date)!;
        lastKnown.set(code, val);
        row[code] = val;
      } else if (lastKnown.has(code)) {
        row[code] = lastKnown.get(code)!;
      }
    }
    return row;
  });

  return { data, fundCodes: validFundCodes };
}
