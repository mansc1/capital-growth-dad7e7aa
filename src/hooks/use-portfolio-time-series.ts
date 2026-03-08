import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PortfolioSnapshot, ChartRange } from '@/types/portfolio';
import { subMonths } from 'date-fns';

export function usePortfolioTimeSeries(range: ChartRange = 'ALL') {
  return useQuery({
    queryKey: ['portfolio_time_series', range],
    queryFn: async () => {
      const [txRes, navRes] = await Promise.all([
        supabase.from('transactions').select('*').order('trade_date'),
        supabase.from('nav_history').select('*').order('nav_date', { ascending: true }),
      ]);

      if (txRes.error) throw txRes.error;
      if (navRes.error) throw navRes.error;

      const txData = (txRes.data || []).map(t => ({
        ...t,
        units: Number(t.units),
        amount: Number(t.amount),
        fee: Number(t.fee),
      }));
      const navData = navRes.data || [];

      // Build NAV lookup: fundId → dateStr → nav_per_unit
      const navLookup = new Map<string, Map<string, number>>();
      for (const row of navData) {
        if (!navLookup.has(row.fund_id)) navLookup.set(row.fund_id, new Map());
        navLookup.get(row.fund_id)!.set(row.nav_date, Number(row.nav_per_unit));
      }

      // Group transactions by date, sorted deterministically within each date
      const txByDate = new Map<string, typeof txData>();
      for (const tx of txData) {
        const d = tx.trade_date;
        if (!txByDate.has(d)) txByDate.set(d, []);
        txByDate.get(d)!.push(tx);
      }
      for (const [, txs] of txByDate) {
        txs.sort((a, b) => {
          const cmp = a.created_at.localeCompare(b.created_at);
          return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
        });
      }

      // Collect all unique dates
      const dateSet = new Set<string>();
      for (const tx of txData) dateSet.add(tx.trade_date);
      for (const row of navData) dateSet.add(row.nav_date);
      const allDates = Array.from(dateSet).sort();

      // Compute range start
      let rangeStart: string | null = null;
      if (range !== 'ALL') {
        const months = range === '1M' ? 1 : 3;
        rangeStart = subMonths(new Date(), months).toISOString().split('T')[0];
      }

      // Walk dates
      const fundState = new Map<string, { units: number; cost: number; lastKnownNav: number | null }>();
      let latestActualNavDate: string | null = null;
      const result: PortfolioSnapshot[] = [];

      for (const date of allDates) {
        // Apply transactions for this date
        const dayTxs = txByDate.get(date);
        if (dayTxs) {
          for (const tx of dayTxs) {
            if (!fundState.has(tx.fund_id)) {
              fundState.set(tx.fund_id, { units: 0, cost: 0, lastKnownNav: null });
            }
            const state = fundState.get(tx.fund_id)!;
            const type = tx.tx_type;

            if (type === 'buy' || type === 'switch_in') {
              state.units += tx.units;
              state.cost += tx.amount + tx.fee;
            } else if (type === 'sell' || type === 'switch_out') {
              if (state.units > 0) {
                const preUnits = state.units;
                const costReduction = (tx.units / preUnits) * state.cost;
                state.units -= tx.units;
                state.cost -= costReduction;
              }
              if (state.units <= 0.0001) {
                state.units = 0;
                state.cost = 0;
              }
            } else if (type === 'dividend') {
              if (tx.dividend_type === 'reinvest') {
                state.units += tx.units;
                state.cost += tx.amount;
              }
              // cash: no-op
            }
          }
        }

        // Update carry-forward NAV from real observations
        let hasNavObservation = false;
        for (const [fundId, navMap] of navLookup) {
          const nav = navMap.get(date);
          if (nav !== undefined) {
            if (!fundState.has(fundId)) {
              fundState.set(fundId, { units: 0, cost: 0, lastKnownNav: null });
            }
            fundState.get(fundId)!.lastKnownNav = nav;
            hasNavObservation = true;
          }
        }
        if (hasNavObservation) {
          latestActualNavDate = date;
        }

        // Check if any fund has units > 0
        let anyHoldings = false;
        let totalValue = 0;
        let totalCost = 0;

        for (const [, state] of fundState) {
          if (state.units > 0) {
            anyHoldings = true;
            totalCost += state.cost;
            if (state.lastKnownNav !== null) {
              totalValue += state.units * state.lastKnownNav;
            } else {
              // Cost-basis fallback
              totalValue += state.cost;
            }
          }
        }

        if (!anyHoldings) continue;
        if (rangeStart && date < rangeStart) continue;

        const totalGainLoss = totalValue - totalCost;
        const totalReturnPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

        result.push({
          id: date,
          snapshot_date: date,
          total_value: totalValue,
          total_cost: totalCost,
          total_gain_loss: totalGainLoss,
          total_return_percent: totalReturnPercent,
          latest_nav_date: latestActualNavDate,
          created_at: date,
        });
      }

      return result;
    },
  });
}
