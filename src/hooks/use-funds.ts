import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Fund } from '@/types/portfolio';

export function useFunds() {
  return useQuery({
    queryKey: ['funds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funds')
        .select('*')
        .order('fund_code');
      if (error) throw error;
      return data as Fund[];
    },
  });
}

export function useFund(id: string | undefined) {
  return useQuery({
    queryKey: ['funds', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('funds')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Fund;
    },
    enabled: !!id,
  });
}
