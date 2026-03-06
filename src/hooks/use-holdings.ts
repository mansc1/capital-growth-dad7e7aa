import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computeHoldings } from '@/lib/holdings';
import type { Fund, Transaction, Holding } from '@/types/portfolio';

export function useHoldings(includeZero = false) {
  return useQuery({
    queryKey: ['holdings', includeZero],
    queryFn: async () => {
      // Fetch funds, transactions, and latest NAVs in parallel
      const fundsQuery = supabase.from('funds').select('*').order('fund_code');
      if (!includeZero) fundsQuery.eq('is_active', true);
      const [fundsRes, txRes, navRes] = await Promise.all([
        fundsQuery,
        supabase.from('transactions').select('*').order('trade_date'),
        supabase.from('nav_history').select('fund_id, nav_per_unit, nav_date').order('fund_id').order('nav_date', { ascending: false }),
      ]);

      if (fundsRes.error) throw fundsRes.error;
      if (txRes.error) throw txRes.error;
      if (navRes.error) throw navRes.error;

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

      return computeHoldings(fundsRes.data as Fund[], transactions, latestNavs, includeZero);
    },
  });
}
