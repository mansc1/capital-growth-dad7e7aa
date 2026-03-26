import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rebuildPortfolioSnapshotsForToday } from "../_shared/portfolio/rebuild-portfolio-snapshots.ts";
import { loadFullSecDirectory } from "../_shared/nav/load-sec-directory.ts";
import { writeBackPendingTransactions } from "../_shared/nav/write-back-pending-transactions.ts";
import { SecApiClient, delay, THROTTLE_DELAY_MS } from "../_shared/sec-api/client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BACKFILL_CAP_DAYS = 365;

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function toDateStr(date: Date): string {
  return date.toISOString().substring(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("NAV_SYNC_CRON_SECRET") ?? "";
  const secApiKey = Deno.env.get("SEC_DAILY_API_KEY") ?? Deno.env.get("SEC_API_KEY") ?? "";

  // Auth
  const cronSecretHeader = req.headers.get("x-cron-secret") ?? "";
  const apiKeyHeader = req.headers.get("apikey") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  const cronAuth = cronSecret && cronSecretHeader === cronSecret;
  const hasApiKey = apiKeyHeader.length > 0 || bearerToken.length > 0;

  if (!cronAuth && !hasApiKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!secApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "SEC API key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const client = new SecApiClient(secApiKey);

  const summary = {
    jobsClaimed: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    totalRowsInserted: 0,
    totalRowsUpdated: 0,
  };

  try {
    // 1. Select pending jobs (limit 10, oldest first)
    const { data: pendingJobs, error: selectErr } = await supabase
      .from("nav_backfill_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (selectErr) throw new Error(`Failed to select pending jobs: ${selectErr.message}`);
    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(JSON.stringify({ ...summary, message: "No pending jobs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Load SEC directory for proj_id resolution
    const projIdMap = await loadFullSecDirectory(supabase, "process-backfill");

    // 3. Process each job
    for (const job of pendingJobs) {
      const { data: claimed, error: claimErr } = await supabase
        .from("nav_backfill_queue")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("status", "pending")
        .select("id")
        .single();

      if (claimErr || !claimed) continue;

      summary.jobsClaimed++;

      let jobRowsInserted = 0;
      let jobRowsUpdated = 0;
      let jobError: string | null = null;

      try {
        const { data: fund, error: fundErr } = await supabase
          .from("funds")
          .select("id, fund_code, sec_fund_code")
          .eq("id", job.fund_id)
          .single();

        if (fundErr || !fund) {
          throw new Error(`Fund not found: ${job.fund_id}`);
        }

        const lookupCode = fund.sec_fund_code ?? fund.fund_code;
        const projId = projIdMap.get(lookupCode.trim().toUpperCase());

        if (!projId) {
          throw new Error(`No proj_id in SEC directory for ${lookupCode}`);
        }

        // Apply 365-day cap
        const endDate = new Date(job.requested_end_date + "T00:00:00Z");
        let startDate = new Date(job.requested_start_date + "T00:00:00Z");
        const capStart = addDays(endDate, -(BACKFILL_CAP_DAYS - 1));
        if (startDate < capStart) {
          startDate = capStart;
        }

        // Preload existing nav_history
        const { data: existingNavRows } = await supabase
          .from("nav_history")
          .select("nav_date, nav_per_unit")
          .eq("fund_id", fund.id)
          .gte("nav_date", toDateStr(startDate))
          .lte("nav_date", job.requested_end_date);

        const existingNavMap = new Map<string, number>();
        for (const row of existingNavRows ?? []) {
          existingNavMap.set(row.nav_date, Number(row.nav_per_unit));
        }

        // Iterate weekdays in range
        const current = new Date(startDate);
        while (current <= endDate) {
          const dateStr = toDateStr(current);

          if (isWeekend(current)) {
            current.setDate(current.getDate() + 1);
            continue;
          }

          try {
            const navResult = await client.fetchDailyNav(projId, dateStr, "[process-backfill]");

            if (navResult.status !== "ok") {
              await delay(THROTTLE_DELAY_MS);
              current.setDate(current.getDate() + 1);
              continue;
            }

            const navPerUnit = navResult.navPerUnit;
            const existingNav = existingNavMap.get(dateStr);
            const now = new Date().toISOString();

            if (existingNav !== undefined) {
              if (existingNav !== navPerUnit) {
                const { error: updateErr } = await supabase
                  .from("nav_history")
                  .update({
                    nav_per_unit: navPerUnit,
                    source: "sec_th_backfill",
                    fetched_at: now,
                  })
                  .eq("fund_id", fund.id)
                  .eq("nav_date", dateStr);
                if (!updateErr) {
                  jobRowsUpdated++;
                  try {
                    const wb = await writeBackPendingTransactions(supabase, fund.id, dateStr, navPerUnit);
                    if (wb > 0) console.log(`[write-back] Updated ${wb} transaction(s) for fund=${fund.id} date=${dateStr}`);
                  } catch (wbErr) {
                    console.warn(`[write-back] Failed for fund=${fund.id} date=${dateStr}:`, (wbErr as Error).message);
                  }
                }
              }
            } else {
              const { error: insertErr } = await supabase
                .from("nav_history")
                .insert({
                  fund_id: fund.id,
                  nav_date: dateStr,
                  nav_per_unit: navPerUnit,
                  source: "sec_th_backfill",
                  fetched_at: now,
                });
              if (!insertErr) {
                jobRowsInserted++;
                try {
                  const wb = await writeBackPendingTransactions(supabase, fund.id, dateStr, navPerUnit);
                  if (wb > 0) console.log(`[write-back] Updated ${wb} transaction(s) for fund=${fund.id} date=${dateStr}`);
                } catch (wbErr) {
                  console.warn(`[write-back] Failed for fund=${fund.id} date=${dateStr}:`, (wbErr as Error).message);
                }
              }
            }
          } catch (err) {
            console.error(`[process-backfill] Error on ${dateStr}:`, (err as Error).message);
          }

          await delay(THROTTLE_DELAY_MS);
          current.setDate(current.getDate() + 1);
        }
      } catch (err) {
        jobError = (err as Error).message;
      }

      // Update job status
      summary.totalRowsInserted += jobRowsInserted;
      summary.totalRowsUpdated += jobRowsUpdated;

      if (jobError) {
        summary.jobsFailed++;
        await supabase
          .from("nav_backfill_queue")
          .update({
            status: "failed",
            last_error: jobError,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      } else {
        summary.jobsCompleted++;
        await supabase
          .from("nav_backfill_queue")
          .update({
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      }
    }

    // 4. Rebuild portfolio snapshot only if data actually changed
    if (summary.totalRowsInserted > 0 || summary.totalRowsUpdated > 0) {
      try {
        await rebuildPortfolioSnapshotsForToday(supabase);
      } catch (err) {
        console.error("[process-backfill] Snapshot rebuild failed:", (err as Error).message);
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ...summary, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
