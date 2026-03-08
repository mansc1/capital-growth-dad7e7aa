import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computeHoldings } from '@/lib/holdings';
import type { Fund, Transaction, Holding } from '@/types/portfolio';

export function useHoldings(includeZero = false) {
  return useQuery({
    queryKey: ['holdings', includeZero],
    queryFn: async () => {
      // Fetch funds, transactions, latest NAVs, and active backfill jobs in parallel
      const [fundsRes, txRes, navRes, backfillRes] = await Promise.all([
        supabase.from('funds').select('*').order('fund_code'),
        supabase.from('transactions').select('*').order('trade_date'),
        // Temporary safety net: explicit limit to avoid Supabase's default 1000-row truncation
        // TODO: Replace with a server-side "latest NAV per fund" query for a proper long-term fix
        supabase.from('nav_history').select('fund_id, nav_per_unit, nav_date').order('fund_id').order('nav_date', { ascending: false }).limit(5000),
        supabase.from('nav_backfill_queue').select('fund_id').in('status', ['pending', 'processing']),
      ]);

      if (fundsRes.error) throw fundsRes.error;
      if (txRes.error) throw txRes.error;
      if (navRes.error) throw navRes.error;
      // backfill query is best-effort
      const activeBackfillFundIds = new Set<string>(
        (backfillRes.data || []).map((r) => r.fund_id)
      );

      const latestNavs: Record<string, { nav_per_unit: number; nav_date: string }> = {};
      for (const row of navRes.data || []) {
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
