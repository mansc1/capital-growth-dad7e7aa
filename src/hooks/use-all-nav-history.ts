import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { NavHistory, ChartRange } from '@/types/portfolio';
import { rangeToStartDate } from '@/lib/chart-range';

export function useAllNavHistory(range: ChartRange = 'ALL', fundIds?: string[]) {
  return useQuery({
    queryKey: ['all_nav_history', range, fundIds],
    enabled: !fundIds || fundIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from('nav_history')
        .select('*')
        .order('nav_date', { ascending: true });

      if (fundIds?.length) {
        query = query.in('fund_id', fundIds);
      }

      const from = rangeToStartDate(range);
      if (from) {
        query = query.gte('nav_date', from);
      }

      const { data, error } = await query.limit(10000);
      if (error) throw error;
      return data as NavHistory[];
    },
  });
}
