import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SecFundResult } from '@/hooks/use-sec-fund-search';

export function useEnsureFund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (result: SecFundResult): Promise<string> => {
      const norm = result.proj_abbr_name.trim().toUpperCase();

      // Check for existing fund with matching code
      const { data: existingFunds, error: fetchError } = await supabase
        .from('funds')
        .select('id, fund_code, sec_fund_code');
      if (fetchError) throw fetchError;

      const match = existingFunds?.find((f) => {
        const secCode = f.sec_fund_code?.trim().toUpperCase();
        const fundCode = f.fund_code.trim().toUpperCase();
        return secCode === norm || fundCode === norm;
      });

      if (match) return match.id;

      // Create new fund
      const fundName = result.proj_name_en || result.proj_name_th || result.proj_abbr_name;
      const { data: newFund, error: insertError } = await supabase
        .from('funds')
        .insert({
          fund_code: result.proj_abbr_name,
          sec_fund_code: result.proj_abbr_name,
          fund_name: fundName,
          amc_name: result.amc_name || 'Unknown',
          is_active: true,
          currency: 'THB',
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      // Invalidate both fund query keys before returning
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['funds'] }),
        queryClient.invalidateQueries({ queryKey: ['funds', 'active'] }),
      ]);

      toast.success(`Fund "${result.proj_abbr_name}" added`);
      return newFund.id;
    },
    onError: (err) => toast.error(`Failed to add fund: ${err.message}`),
  });
}
