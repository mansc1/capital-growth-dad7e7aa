import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PortfolioSnapshot, ChartRange } from '@/types/portfolio';
import { subMonths } from 'date-fns';

export function usePortfolioSnapshots(range: ChartRange = 'ALL') {
  return useQuery({
    queryKey: ['portfolio_snapshots', range],
    queryFn: async () => {
      let query = supabase
        .from('portfolio_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: true });

      if (range !== 'ALL') {
        const months = range === '1M' ? 1 : 3;
        const from = subMonths(new Date(), months).toISOString().split('T')[0];
        query = query.gte('snapshot_date', from);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PortfolioSnapshot[];
    },
  });
}
