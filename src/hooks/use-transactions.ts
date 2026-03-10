import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { checkAndEnqueueBackfill } from '@/hooks/use-check-nav-coverage';
import type { Transaction, TransactionWithFund, TxType, DividendType } from '@/types/portfolio';

export function useTransactions(fundId?: string) {
  return useQuery({
    queryKey: ['transactions', fundId],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*, funds(*)')
        .order('trade_date', { ascending: false });
      if (fundId) query = query.eq('fund_id', fundId);
      const { data, error } = await query;
      if (error) throw error;
      return data as TransactionWithFund[];
    },
  });
}

export interface CreateTransactionInput {
  fund_id: string;
  tx_type: TxType;
  trade_date: string;
  units: number;
  amount: number;
  nav_at_trade: number;
  fee: number;
  note?: string;
  dividend_type?: DividendType | null;
}

export interface TransactionMutationResult {
  data: any;
  backfillEnqueued: boolean;
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransactionInput): Promise<TransactionMutationResult> => {
      const { data, error } = await supabase
        .from('transactions')
        .insert(input)
        .select()
        .single();
      if (error) throw error;

      const backfillEnqueued = await checkAndEnqueueBackfill(data.fund_id, data.trade_date);
      return { data, backfillEnqueued };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['holdings'] });
      qc.invalidateQueries({ queryKey: ['portfolio_time_series'] });
      qc.invalidateQueries({ queryKey: ['all_nav_history'] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CreateTransactionInput & { id: string }): Promise<TransactionMutationResult> => {
      const { data, error } = await supabase
        .from('transactions')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      const backfillEnqueued = await checkAndEnqueueBackfill(data.fund_id, data.trade_date);
      return { data, backfillEnqueued };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['holdings'] });
      qc.invalidateQueries({ queryKey: ['portfolio_time_series'] });
      qc.invalidateQueries({ queryKey: ['all_nav_history'] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['holdings'] });
    },
  });
}
