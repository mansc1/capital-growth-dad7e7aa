import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves an existing fund_id from the funds table by exact normalized
 * sec_fund_code match. Used to enable NAV autofill for pending SEC-selected
 * funds before they are formally created.
 *
 * Current approach fetches all funds with a sec_fund_code and matches
 * client-side for exact normalized comparison. Can be optimized to a
 * server-side filter if the funds table grows significantly.
 */
export function useResolveFundIdBySecCode(secFundCode: string | undefined) {
  const normalized = secFundCode?.trim().toUpperCase() || '';

  const { data, isLoading } = useQuery({
    queryKey: ['resolve_fund_by_sec_code', normalized],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funds')
        .select('id, sec_fund_code')
        .not('sec_fund_code', 'is', null)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const match = data?.find(
        (f) => f.sec_fund_code?.trim().toUpperCase() === normalized
      );
      return match?.id ?? null;
    },
    enabled: normalized.length > 0,
  });

  return {
    resolvedFundId: data ?? undefined,
    isResolving: isLoading,
  };
}
