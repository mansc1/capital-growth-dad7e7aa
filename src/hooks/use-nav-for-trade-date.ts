import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NavForTradeDateResult {
  nav: number | null;
  navDateUsed: string | null;
  isExactMatch: boolean;
  isLoading: boolean;
}

export function useNavForTradeDate(
  fundId: string | undefined,
  tradeDate: string | undefined
): NavForTradeDateResult {
  const enabled = !!fundId && !!tradeDate;

  const { data, isLoading } = useQuery({
    queryKey: ['nav_for_trade_date', fundId, tradeDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nav_history')
        .select('nav_per_unit, nav_date')
        .eq('fund_id', fundId!)
        .lte('nav_date', tradeDate!)
        .order('nav_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled,
  });

  if (!enabled) {
    return { nav: null, navDateUsed: null, isExactMatch: false, isLoading: false };
  }

  return {
    nav: data?.nav_per_unit != null ? Number(data.nav_per_unit) : null,
    navDateUsed: data?.nav_date ?? null,
    isExactMatch: data?.nav_date === tradeDate,
    isLoading,
  };
}
