import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { NavHistory } from '@/types/portfolio';

export function useNavHistory(fundId?: string) {
  return useQuery({
    queryKey: ['nav_history', fundId],
    queryFn: async () => {
      let firstTradeDate: string | undefined;
      if (fundId) {
        const { data: firstTx } = await supabase
          .from('transactions')
          .select('trade_date')
          .eq('fund_id', fundId)
          .order('trade_date', { ascending: true })
          .limit(1);
        firstTradeDate = firstTx?.[0]?.trade_date;
      }

      let query = supabase
        .from('nav_history')
        .select('*')
        .order('nav_date', { ascending: true });

      if (fundId) query = query.eq('fund_id', fundId);
      if (firstTradeDate) query = query.gte('nav_date', firstTradeDate);

      const { data, error } = await query.limit(10000);
      if (error) throw error;
      return data as NavHistory[];
    },
  });
}

export function useLatestNavs() {
  return useQuery({
    queryKey: ['latest_navs'],
    queryFn: async () => {
      // Get latest NAV per fund using distinct on
      const { data, error } = await supabase
        .from('nav_history')
        .select('fund_id, nav_per_unit, nav_date')
        .order('fund_id')
        .order('nav_date', { ascending: false })
        .limit(10000);
      if (error) throw error;
      
      // Get latest per fund
      const latestMap: Record<string, { nav_per_unit: number; nav_date: string }> = {};
      for (const row of data || []) {
        if (!latestMap[row.fund_id]) {
          latestMap[row.fund_id] = { nav_per_unit: row.nav_per_unit, nav_date: row.nav_date };
        }
      }
      return latestMap;
    },
  });
}
