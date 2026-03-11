import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PortfolioSnapshot, ChartRange } from '@/types/portfolio';
import { rangeToStartDate } from '@/lib/chart-range';

export function usePortfolioSnapshots(range: ChartRange = 'SINCE_START') {
  return useQuery({
    queryKey: ['portfolio_snapshots', range],
    queryFn: async () => {
      let query = supabase
        .from('portfolio_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: true });

      const from = rangeToStartDate(range);
      if (from) {
        query = query.gte('snapshot_date', from);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PortfolioSnapshot[];
    },
  });
}
