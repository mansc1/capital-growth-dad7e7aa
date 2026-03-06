import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface SyncResult {
  success: boolean;
  processedFunds: number;
  insertedRows: number;
  updatedRows: number;
  skippedFunds: number;
  latestNavDate: string | null;
  syncRunId: string;
  errors: string[];
}

export function useNavSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const syncNav = async (): Promise<SyncResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("sync-nav", {
        body: { trigger_type: "manual" },
      });

      if (fnErr) throw new Error(fnErr.message);

      const result = data as SyncResult;

      // Invalidate all relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["portfolio_snapshots"] }),
        queryClient.invalidateQueries({ queryKey: ["nav_history"] }),
        queryClient.invalidateQueries({ queryKey: ["all_nav_history"] }),
        queryClient.invalidateQueries({ queryKey: ["holdings"] }),
        queryClient.invalidateQueries({ queryKey: ["sync_runs"] }),
        queryClient.invalidateQueries({ queryKey: ["latest_navs"] }),
      ]);

      return result;
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { syncNav, isLoading, error };
}
