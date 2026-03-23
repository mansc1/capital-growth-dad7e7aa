import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';

export function useHoldingsSparklines(fundIds: string[]) {
  const sortedIds = useMemo(() => [...fundIds].sort(), [fundIds]);
  return useQuery({
    queryKey: ['holdings_sparklines', sortedIds],
    enabled: sortedIds.length > 0,
    queryFn: async () => {
      const from = subDays(new Date(), 90).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('nav_history')
        .select('fund_id, nav_per_unit, nav_date')
        .in('fund_id', sortedIds)
        .gte('nav_date', from)
        .order('nav_date', { ascending: true })
        .limit(5000);
      if (error) throw error;
      const map: Record<string, number[]> = {};
      for (const r of data || []) {
        (map[r.fund_id] ??= []).push(Number(r.nav_per_unit));
      }
      return map;
    },
  });
}
