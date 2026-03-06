import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SyncRun {
  id: string;
  job_name: string;
  trigger_type: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  processed_count: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  error_message: string | null;
  created_at: string;
}

export function useSyncRuns(limit = 10) {
  return useQuery({
    queryKey: ["sync_runs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_runs" as any)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as unknown as SyncRun[]) ?? [];
    },
  });
}

export function useLastSuccessfulSync() {
  const { data: runs, isLoading } = useSyncRuns(10);

  const lastSuccess = runs?.find((r) => r.status === "success") ?? null;
  const latestRun = runs?.[0] ?? null;

  return {
    lastSuccess,
    latestRun,
    isLoading,
  };
}
