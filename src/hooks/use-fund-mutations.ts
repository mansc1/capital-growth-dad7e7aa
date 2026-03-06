import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const INVALIDATE_KEYS = [['funds'], ['holdings'], ['holdings', true]];

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => Promise.all(INVALIDATE_KEYS.map((k) => qc.invalidateQueries({ queryKey: k })));
}

interface FundInput {
  fund_code: string;
  fund_name: string;
  amc_name: string;
  sec_fund_code?: string | null;
  category?: string | null;
  asset_class?: string | null;
  risk_level?: number | null;
  currency?: string;
}

export function useCreateFund() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: FundInput) => {
      const { data, error } = await supabase
        .from('funds')
        .insert({
          fund_code: input.fund_code,
          fund_name: input.fund_name,
          amc_name: input.amc_name,
          sec_fund_code: input.sec_fund_code ?? null,
          category: input.category ?? null,
          asset_class: input.asset_class ?? null,
          risk_level: input.risk_level ?? null,
          currency: input.currency ?? 'THB',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Fund created');
      invalidate();
    },
    onError: (err) => toast.error(`Failed to create fund: ${err.message}`),
  });
}

export function useUpdateFund() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, ...input }: FundInput & { id: string }) => {
      const { data, error } = await supabase
        .from('funds')
        .update({
          fund_code: input.fund_code,
          fund_name: input.fund_name,
          amc_name: input.amc_name,
          sec_fund_code: input.sec_fund_code ?? null,
          category: input.category ?? null,
          asset_class: input.asset_class ?? null,
          risk_level: input.risk_level ?? null,
          currency: input.currency ?? 'THB',
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Fund updated');
      invalidate();
    },
    onError: (err) => toast.error(`Failed to update fund: ${err.message}`),
  });
}

export function useArchiveFund() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('funds')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Fund archived');
      invalidate();
    },
    onError: (err) => toast.error(`Failed to archive fund: ${err.message}`),
  });
}

export function useRestoreFund() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('funds')
        .update({ is_active: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Fund restored');
      invalidate();
    },
    onError: (err) => toast.error(`Failed to restore fund: ${err.message}`),
  });
}
