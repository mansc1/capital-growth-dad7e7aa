import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Fund } from '@/types/portfolio';

export function useActiveFunds() {
  return useQuery({
    queryKey: ['funds', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funds')
        .select('*')
        .eq('is_active', true)
        .order('fund_code');
      if (error) throw error;
      return data as Fund[];
    },
  });
}
