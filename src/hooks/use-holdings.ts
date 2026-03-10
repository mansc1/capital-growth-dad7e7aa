import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computeHoldings } from '@/lib/holdings';
import type { Fund, Transaction, Holding } from '@/types/portfolio';

export function useHoldings(includeZero = false) {
  return useQuery({
    queryKey: ['holdings', includeZero],
    queryFn: async () => {
      // Phase 1: Fetch funds, transactions, and backfill status in parallel
      const [fundsRes, txRes, backfillRes] = await Promise.all([
        supabase.from('funds').select('*').order('fund_code'),
        supabase.from('transactions').select('*').order('trade_date'),
        supabase.from('nav_backfill_queue').select('fund_id').in('status', ['pending', 'processing']),
      ]);

      if (fundsRes.error) throw fundsRes.error;
      if (txRes.error) throw txRes.error;
      // backfill query is best-effort
      const activeBackfillFundIds = new Set<string>(
        (backfillRes.data || []).map((r) => r.fund_id)
      );

      // Extract relevant fund IDs from transactions to filter NAV query
      const fundIds = [...new Set((txRes.data || []).map(t => t.fund_id))];

      // Phase 2: Fetch nav_history filtered by held fund IDs only
      let navData: { fund_id: string; nav_per_unit: number; nav_date: string }[] = [];
      if (fundIds.length > 0) {
        const navRes = await supabase
          .from('nav_history')
          .select('fund_id, nav_per_unit, nav_date')
          .in('fund_id', fundIds)
          .order('fund_id')
          .order('nav_date', { ascending: false })
          .limit(5000);
        if (navRes.error) throw navRes.error;
        navData = navRes.data || [];
      }

      const latestNavs: Record<string, { nav_per_unit: number; nav_date: string }> = {};
      for (const row of navData) {
        if (!latestNavs[row.fund_id]) {
          latestNavs[row.fund_id] = { nav_per_unit: Number(row.nav_per_unit), nav_date: row.nav_date };
        }
      }

      const transactions = (txRes.data || []).map(t => ({
        ...t,
        units: Number(t.units),
        amount: Number(t.amount),
        fee: Number(t.fee),
      }));

      return computeHoldings(fundsRes.data as Fund[], transactions, latestNavs, includeZero, activeBackfillFundIds);
    },
  });
}
