import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PortfolioSnapshot, ChartRange } from '@/types/portfolio';
import { rangeToStartDate } from '@/lib/chart-range';

export function usePortfolioTimeSeries(range: ChartRange = 'ALL') {
  return useQuery({
    queryKey: ['portfolio_time_series', range],
    queryFn: async () => {
      // Sequential: need fund IDs before filtering nav_history
      const txRes = await supabase.from('transactions').select('*').order('trade_date');
      if (txRes.error) throw txRes.error;

      const txData = (txRes.data || []).map(t => ({
        ...t,
        units: Number(t.units),
        amount: Number(t.amount),
        fee: Number(t.fee),
      }));

      const fundIds = [...new Set(txData.map(t => t.fund_id))].sort();
      if (fundIds.length === 0) return [];

      const navRes = await supabase
        .from('nav_history')
        .select('*')
        .in('fund_id', fundIds)
        .order('nav_date', { ascending: true })
        .limit(10000);
      if (navRes.error) throw navRes.error;
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

      // Collect transaction dates separately for start boundary
      const txDates = txData.map(t => t.trade_date).sort();
      if (txDates.length === 0) return [];

      // Merge all dates for end boundary
      const allDateSet = new Set<string>(txDates);
      for (const row of navData) allDateSet.add(row.nav_date);
      const sortedAll = Array.from(allDateSet).sort();

      const startDateStr = txDates[0];                        // earliest transaction
      const endDateStr = sortedAll[sortedAll.length - 1];     // latest of tx or nav

      // Generate continuous daily dates from start to end
      const allDates: string[] = [];
      const cur = new Date(startDateStr + 'T00:00:00');
      const endD = new Date(endDateStr + 'T00:00:00');
      while (cur <= endD) {
        allDates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }

      // Compute range start
      const rangeStart = rangeToStartDate(range);

      // Walk dates
      const fundState = new Map<string, { units: number; cost: number; lastKnownNav: number | null }>();
      let latestActualNavDate: string | null = null;
      const result: PortfolioSnapshot[] = [];

      for (const date of allDates) {
        let dayNetFlow = 0;
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
              dayNetFlow += tx.amount;
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
              dayNetFlow -= tx.amount;
            } else if (type === 'dividend') {
              if (tx.dividend_type === 'reinvest') {
                state.units += tx.units;
                state.cost += tx.amount;
                dayNetFlow += tx.amount;
              }
              // cash: no-op (no portfolio value change, no flow)
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
          net_flow: dayNetFlow,
          has_transaction: !!dayTxs,
          tx_count: dayTxs ? dayTxs.length : 0,
        });
      }

      return result;
    },
  });
}
