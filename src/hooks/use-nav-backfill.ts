import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const NAV_SYNC_SECRET = "navsync_9f7c21c4a6e94b3b8d9a2e5c6f7d1b0";

export interface BackfillResult {
  success: boolean;
  fundsProcessed: number;
  fundsSkipped: number;
  datesChecked: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkipped: number;
  weekendsSkipped: number;
  noDataDates: number;
  cappedFunds: { fundCode: string; requestedStart: string; actualStart: string; endDate: string }[];
  unresolvedFunds: string[];
  apiErrors: string[];
  syncRunId: string;
}

export function useNavBackfill() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const backfillNav = async (): Promise<BackfillResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/backfill-nav`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": NAV_SYNC_SECRET,
        },
      });

      if (!res.ok) throw new Error(`Backfill failed: ${res.status}`);
      const result = (await res.json()) as BackfillResult;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["nav_history"] }),
        queryClient.invalidateQueries({ queryKey: ["all_nav_history"] }),
        queryClient.invalidateQueries({ queryKey: ["sync_runs"] }),
        queryClient.invalidateQueries({ queryKey: ["portfolio_snapshots"] }),
        queryClient.invalidateQueries({ queryKey: ["holdings"] }),
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

  return { backfillNav, isLoading, error };
}
