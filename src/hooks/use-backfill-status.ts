import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useBackfillStatus() {
  const queryClient = useQueryClient();
  const prevCount = useRef<number>(0);

  const { data: activeCount = 0, isLoading } = useQuery({
    queryKey: ["backfill_queue_status"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("nav_backfill_queue")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "processing"]);

      if (error) {
        console.error("[backfill-status] query error:", error.message);
        return 0;
      }
      return count ?? 0;
    },
    refetchInterval: (query) => {
      const count = query.state.data ?? 0;
      return count > 0 ? 5000 : false;
    },
  });

  // Transition-based invalidation: when active jobs go from >0 to 0
  useEffect(() => {
    if (prevCount.current > 0 && activeCount === 0) {
      queryClient.invalidateQueries({ queryKey: ["nav_history"] });
      queryClient.invalidateQueries({ queryKey: ["all_nav_history"] });
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio_snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio_time_series"] });
    }
    prevCount.current = activeCount;
  }, [activeCount, queryClient]);

  return { activeCount, isLoading };
}
