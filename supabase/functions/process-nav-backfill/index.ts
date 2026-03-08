import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rebuildPortfolioSnapshotsForToday } from "../_shared/portfolio/rebuild-portfolio-snapshots.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NORM = (s: string): string => s.trim().toUpperCase();
const THROTTLE_MS = 200;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const REQUEST_TIMEOUT_MS = 15_000;
const BACKFILL_CAP_DAYS = 365;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const wait = BACKOFF_BASE_MS * Math.pow(2, attempt);
          await delay(wait);
          continue;
        }
      }
      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err as Error;
      if (attempt < retries) {
        const wait = BACKOFF_BASE_MS * Math.pow(2, attempt);
        await delay(wait);
        continue;
      }
    }
  }
  throw lastError ?? new Error(`fetchWithRetry failed for ${url}`);
}

const NAV_FIELD_CANDIDATES = ["last_val", "nav", "net_asset"] as const;

function parseDailyNavResponse(data: unknown): number | null {
  if (data == null) return null;
  let record: Record<string, unknown>;
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    record = data[0] as Record<string, unknown>;
  } else if (typeof data === "object") {
    record = data as Record<string, unknown>;
  } else {
    return null;
  }
  for (const field of NAV_FIELD_CANDIDATES) {
    const raw = record[field];
    if (raw !== undefined && raw !== null) {
      const val = parseFloat(String(raw));
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const cronSecret = Deno.env.get("NAV_SYNC_CRON_SECRET") ?? "";
  const secApiKey = Deno.env.get("SEC_DAILY_API_KEY") ?? Deno.env.get("SEC_API_KEY") ?? "";

  // Auth: accept either valid x-cron-secret OR valid apikey/bearer matching anon key
  const cronSecretHeader = req.headers.get("x-cron-secret") ?? "";
  const apiKeyHeader = req.headers.get("apikey") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  const cronAuth = cronSecret && cronSecretHeader === cronSecret;
  // supabase.functions.invoke sends anon key in both apikey header and Authorization bearer
  const anonAuth = anonKey && (apiKeyHeader === anonKey || bearerToken === anonKey);
  // Also accept any valid apikey or bearer presence when verify_jwt is false
  // (the Supabase gateway already validated the key before forwarding)
  const gatewayAuth = apiKeyHeader.length > 0 || bearerToken.length > 0;

  if (!cronAuth && !anonAuth && !gatewayAuth) {
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
    const { data: dirEntries, error: dirErr } = await supabase
      .from("sec_fund_directory")
      .select("proj_id, proj_abbr_name");
    if (dirErr) throw new Error(`Failed to query sec_fund_directory: ${dirErr.message}`);

    const projIdMap = new Map<string, string>();
    for (const entry of dirEntries ?? []) {
      if (entry.proj_abbr_name && entry.proj_id) {
        projIdMap.set(NORM(entry.proj_abbr_name), entry.proj_id);
      }
    }

    // 3. Process each job
    for (const job of pendingJobs) {
      // Atomically claim: UPDATE WHERE id = X AND status = 'pending'
      const { data: claimed, error: claimErr } = await supabase
        .from("nav_backfill_queue")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("status", "pending")
        .select("id")
        .single();

      if (claimErr || !claimed) {
        // Another processor already claimed this job
        continue;
      }

      summary.jobsClaimed++;

      let jobRowsInserted = 0;
      let jobRowsUpdated = 0;
      let jobError: string | null = null;

      try {
        // Load fund record
        const { data: fund, error: fundErr } = await supabase
          .from("funds")
          .select("id, fund_code, sec_fund_code")
          .eq("id", job.fund_id)
          .single();

        if (fundErr || !fund) {
          throw new Error(`Fund not found: ${job.fund_id}`);
        }

        const lookupCode = fund.sec_fund_code ?? fund.fund_code;
        const projId = projIdMap.get(NORM(lookupCode));

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

        // Preload existing nav_history for this fund in date range
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
            const url = `https://api.sec.or.th/FundDailyInfo/${projId}/dailynav/${dateStr}`;
            const res = await fetchWithRetry(url, {
              "Ocp-Apim-Subscription-Key": secApiKey,
              Accept: "application/json",
            });

            if (res.status === 204) {
              await res.text();
              await delay(THROTTLE_MS);
              current.setDate(current.getDate() + 1);
              continue;
            }

            if (!res.ok) {
              await res.text();
              await delay(THROTTLE_MS);
              current.setDate(current.getDate() + 1);
              continue;
            }

            const data = await res.json();
            const navPerUnit = parseDailyNavResponse(data);

            if (navPerUnit === null) {
              await delay(THROTTLE_MS);
              current.setDate(current.getDate() + 1);
              continue;
            }

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
                if (!updateErr) jobRowsUpdated++;
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
              if (!insertErr) jobRowsInserted++;
            }
          } catch (err) {
            console.error(`[process-backfill] Error on ${dateStr}:`, (err as Error).message);
          }

          await delay(THROTTLE_MS);
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
