import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checkAndEnqueueBackfill } from "@/hooks/use-check-nav-coverage";

export interface BackfillResult {
  success: boolean;
  fundsEnqueued: number;
  fundsSkipped: number;
  processorResult: Record<string, unknown> | null;
}

export function useNavBackfill() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const backfillNav = async (): Promise<BackfillResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Query all funds with transactions, find earliest trade_date per fund
      const { data: txRows, error: txErr } = await supabase
        .from("transactions")
        .select("fund_id, trade_date");

      if (txErr) throw new Error(`Failed to query transactions: ${txErr.message}`);

      const earliestTxByFund = new Map<string, string>();
      for (const row of txRows ?? []) {
        const date = row.trade_date.substring(0, 10);
        const existing = earliestTxByFund.get(row.fund_id);
        if (!existing || date < existing) {
          earliestTxByFund.set(row.fund_id, date);
        }
      }

      if (earliestTxByFund.size === 0) {
        return { success: true, fundsEnqueued: 0, fundsSkipped: 0, processorResult: null };
      }

      // 2. Enqueue backfill for each fund using shared gap-detection
      let fundsEnqueued = 0;
      let fundsSkipped = 0;

      for (const [fundId, earliestDate] of earliestTxByFund) {
        const enqueued = await checkAndEnqueueBackfill(fundId, earliestDate);
        if (enqueued) fundsEnqueued++;
        else fundsSkipped++;
      }

      // 3. Call processor and wait (manual path)
      let processorResult: Record<string, unknown> | null = null;
      if (fundsEnqueued > 0) {
        const { data, error: invokeErr } = await supabase.functions.invoke("process-nav-backfill");
        if (invokeErr) {
          console.error("[backfill] Processor invoke error:", invokeErr);
        } else {
          processorResult = data as Record<string, unknown>;
        }
      }

      // 4. Invalidate queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["nav_history"] }),
        queryClient.invalidateQueries({ queryKey: ["all_nav_history"] }),
        queryClient.invalidateQueries({ queryKey: ["sync_runs"] }),
        queryClient.invalidateQueries({ queryKey: ["portfolio_snapshots"] }),
        queryClient.invalidateQueries({ queryKey: ["holdings"] }),
        queryClient.invalidateQueries({ queryKey: ["latest_navs"] }),
        queryClient.invalidateQueries({ queryKey: ["backfill_queue_status"] }),
      ]);

      return { success: true, fundsEnqueued, fundsSkipped, processorResult };
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { backfillNav, isLoading, error };
}
