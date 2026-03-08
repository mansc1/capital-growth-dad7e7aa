import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeHoldings } from "@/lib/holdings";
import type { Fund } from "@/types/portfolio";

export type AlertSeverity = "error" | "warning";

export interface HealthAlert {
  severity: AlertSeverity;
  key: string;
  message: string;
}

export interface NavHealthSummary {
  // Coverage
  trackedFunds: number;
  readyFunds: number;
  waitingForNavFunds: number;
  navUnavailableFunds: number;

  // Freshness
  latestNavDate: string | null;
  staleFunds: number;

  // Backfill queue
  pendingJobs: number;
  processingJobs: number;
  failedJobs: number;

  // Latest sync
  syncStatus: string | null;
  syncCompletedAt: string | null;
  syncProvider: string | null;

  // Directory
  directoryCount: number;

  // Alerts
  alerts: HealthAlert[];
}

const EMPTY_SUMMARY: NavHealthSummary = {
  trackedFunds: 0,
  readyFunds: 0,
  waitingForNavFunds: 0,
  navUnavailableFunds: 0,
  latestNavDate: null,
  staleFunds: 0,
  pendingJobs: 0,
  processingJobs: 0,
  failedJobs: 0,
  syncStatus: null,
  syncCompletedAt: null,
  syncProvider: null,
  directoryCount: 0,
  alerts: [],
};

export function useNavHealth() {
  return useQuery<NavHealthSummary>({
    queryKey: ["nav_system_health"],
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      let trackedFunds = 0;
      let readyFunds = 0;
      let waitingForNavFunds = 0;
      let navUnavailableFunds = 0;
      let latestNavDate: string | null = null;
      let staleFunds = 0;

      // --- Section A: Coverage + Freshness ---
      try {
        const [fundsRes, txRes, navRes, backfillRes] = await Promise.all([
          supabase.from("funds").select("*").order("fund_code"),
          supabase.from("transactions").select("*").order("trade_date"),
          // Safety cap: explicit limit to avoid Supabase's default 1000-row truncation
          // on portfolios with large NAV history. Mirrors the approach in useHoldings.
          supabase
            .from("nav_history")
            .select("fund_id, nav_per_unit, nav_date")
            .order("fund_id")
            .order("nav_date", { ascending: false })
            .limit(5000),
          supabase
            .from("nav_backfill_queue")
            .select("fund_id")
            .in("status", ["pending", "processing"]),
        ]);

        if (fundsRes.error) throw fundsRes.error;
        if (txRes.error) throw txRes.error;
        if (navRes.error) throw navRes.error;

        const activeBackfillFundIds = new Set<string>(
          (backfillRes.data || []).map((r) => r.fund_id)
        );

        // Build latest NAV map (first occurrence per fund = latest due to desc order)
        const latestNavs: Record<string, { nav_per_unit: number; nav_date: string }> = {};
        for (const row of navRes.data || []) {
          if (!latestNavs[row.fund_id]) {
            latestNavs[row.fund_id] = {
              nav_per_unit: Number(row.nav_per_unit),
              nav_date: row.nav_date,
            };
          }
        }

        const transactions = (txRes.data || []).map((t) => ({
          ...t,
          units: Number(t.units),
          amount: Number(t.amount),
          fee: Number(t.fee),
        }));

        const holdings = computeHoldings(
          fundsRes.data as Fund[],
          transactions,
          latestNavs,
          false,
          activeBackfillFundIds
        );

        trackedFunds = holdings.length;
        for (const h of holdings) {
          if (h.valuation_status === "ready") readyFunds++;
          else if (h.valuation_status === "waiting_for_nav") waitingForNavFunds++;
          else if (h.valuation_status === "nav_unavailable") navUnavailableFunds++;
        }

        // Compute latest NAV date with empty guard
        const navDates = Object.values(latestNavs).map((v) => v.nav_date);
        if (navDates.length > 0) {
          latestNavDate = navDates.reduce((a, b) => (a > b ? a : b));
        }

        // Count stale funds: funds with NAV data whose latest date < global latest
        // Skip funds with no NAV entry entirely
        if (latestNavDate) {
          for (const h of holdings) {
            const navEntry = latestNavs[h.fund.id];
            if (!navEntry) continue; // no NAV data — skip, not "stale"
            if (navEntry.nav_date < latestNavDate) {
              staleFunds++;
            }
          }
        }
      } catch (err) {
        console.error("[nav-health] Section A (coverage/freshness) failed:", err);
      }

      // --- Section B: Backfill Queue ---
      let pendingJobs = 0;
      let processingJobs = 0;
      let failedJobs = 0;

      try {
        const { data, error } = await supabase
          .from("nav_backfill_queue")
          .select("status")
          .in("status", ["pending", "processing", "failed"]);

        if (error) throw error;

        for (const row of data || []) {
          if (row.status === "pending") pendingJobs++;
          else if (row.status === "processing") processingJobs++;
          else if (row.status === "failed") failedJobs++;
        }
      } catch (err) {
        console.error("[nav-health] Section B (backfill) failed:", err);
      }

      // --- Section C: Latest Sync ---
      let syncStatus: string | null = null;
      let syncCompletedAt: string | null = null;
      let syncProvider: string | null = null;

      try {
        const { data, error } = await supabase
          .from("sync_runs" as any)
          .select("status, completed_at, provider")
          .order("started_at", { ascending: false })
          .limit(1);

        if (error) throw error;

        const run = (data as any[])?.[0];
        if (run) {
          syncStatus = run.status;
          syncCompletedAt = run.completed_at;
          syncProvider = run.provider;
        }
      } catch (err) {
        console.error("[nav-health] Section C (sync) failed:", err);
      }

      // --- Section D: Directory ---
      let directoryCount = 0;

      try {
        const { count, error } = await supabase
          .from("sec_fund_directory")
          .select("proj_id", { count: "exact", head: true });

        if (error) throw error;
        directoryCount = count ?? 0;
      } catch (err) {
        console.error("[nav-health] Section D (directory) failed:", err);
      }

      // --- Build alerts (deterministic: errors first, then warnings) ---
      const alerts: HealthAlert[] = [];

      // Errors
      if (navUnavailableFunds > 0) {
        alerts.push({
          severity: "error",
          key: "navUnavailable",
          message: `${navUnavailableFunds} fund${navUnavailableFunds !== 1 ? "s" : ""} with no NAV data available`,
        });
      }
      if (failedJobs > 0) {
        alerts.push({
          severity: "error",
          key: "failedJobs",
          message: `${failedJobs} backfill job${failedJobs !== 1 ? "s" : ""} failed`,
        });
      }

      // Warnings
      if (waitingForNavFunds > 0) {
        alerts.push({
          severity: "warning",
          key: "waitingForNav",
          message: `${waitingForNavFunds} fund${waitingForNavFunds !== 1 ? "s" : ""} waiting for NAV data`,
        });
      }
      if (staleFunds > 0) {
        alerts.push({
          severity: "warning",
          key: "staleFunds",
          message: `${staleFunds} fund${staleFunds !== 1 ? "s" : ""} with stale NAV data`,
        });
      }

      return {
        trackedFunds,
        readyFunds,
        waitingForNavFunds,
        navUnavailableFunds,
        latestNavDate,
        staleFunds,
        pendingJobs,
        processingJobs,
        failedJobs,
        syncStatus,
        syncCompletedAt,
        syncProvider,
        directoryCount,
        alerts,
      };
    },
  });
}
