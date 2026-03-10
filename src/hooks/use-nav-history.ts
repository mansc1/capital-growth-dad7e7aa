import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { NavHistory } from '@/types/portfolio';

export function useNavHistory(fundId?: string) {
  return useQuery({
    queryKey: ['nav_history', fundId],
    queryFn: async () => {
      let query = supabase
        .from('nav_history')
        .select('*')
        .order('nav_date', { ascending: true });
      if (fundId) query = query.eq('fund_id', fundId);
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
