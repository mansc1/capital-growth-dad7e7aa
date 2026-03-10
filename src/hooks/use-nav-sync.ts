import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const NAV_SYNC_SECRET = "navsync_9f7c21c4a6e94b3b8d9a2e5c6f7d1b0";

interface SyncResult {
  success: boolean;
  processedFunds: number;
  insertedRows: number;
  updatedRows: number;
  skippedFunds: number;
  latestNavDate: string | null;
  syncRunId: string;
  provider?: string;
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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-nav`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": NAV_SYNC_SECRET,
        },
        body: JSON.stringify({ trigger_type: "manual" }),
      });

      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
      const result = await res.json() as SyncResult;

      // Invalidate all relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["portfolio_snapshots"] }),
        queryClient.invalidateQueries({ queryKey: ["nav_history"] }),
        queryClient.invalidateQueries({ queryKey: ["all_nav_history"] }),
        queryClient.invalidateQueries({ queryKey: ["holdings"] }),
        queryClient.invalidateQueries({ queryKey: ["sync_runs"] }),
        queryClient.invalidateQueries({ queryKey: ["latest_navs"] }),
        queryClient.invalidateQueries({ queryKey: ["portfolio_time_series"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
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
