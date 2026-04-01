import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UpdateNavDataResult {
  success: boolean;
  message: string;
  warnings: string[];
  directoryRefreshed: boolean;
  directoryFunds: number;
  navSyncRan: boolean;
  insertedRows: number;
  updatedRows: number;
  skippedFunds: number;
  backfillJobsEnqueued: number;
  backfillProcessingTriggered: boolean;
  secReachable?: boolean | null;
  errorCategory?: string | null;
}

export function useUpdateNavData() {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const updateNavData = async (): Promise<UpdateNavDataResult | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-nav-data");
      if (error) {
        console.error("[update-nav-data] invoke error:", error);
        return null;
      }
      return data as UpdateNavDataResult;
    } catch (err) {
      console.error("[update-nav-data] exception:", err);
      return null;
    } finally {
      // Always invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["sync_runs"] });
      queryClient.invalidateQueries({ queryKey: ["nav_history"] });
      queryClient.invalidateQueries({ queryKey: ["all_nav_history"] });
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio_snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio_time_series"] });
      queryClient.invalidateQueries({ queryKey: ["latest_navs"] });
      queryClient.invalidateQueries({ queryKey: ["backfill_queue_status"] });
      setIsLoading(false);
    }
  };

  return { updateNavData, isLoading };
}
