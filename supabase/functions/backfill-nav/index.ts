import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rebuildPortfolioSnapshotsForToday } from "../_shared/portfolio/rebuild-portfolio-snapshots.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NORM = (s: string): string => s.trim().toUpperCase();
const BACKFILL_CAP_DAYS = 365;
const THROTTLE_MS = 200;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const REQUEST_TIMEOUT_MS = 15_000;

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
          console.warn(`[backfill] HTTP ${res.status} for ${url}, retrying in ${wait}ms…`);
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

interface BackfillResult {
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
  if (!cronSecret || cronSecretHeader !== cronSecret) {
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

  const result: BackfillResult = {
    success: true,
    fundsProcessed: 0,
    fundsSkipped: 0,
    datesChecked: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
    rowsSkipped: 0,
    weekendsSkipped: 0,
    noDataDates: 0,
    cappedFunds: [],
    unresolvedFunds: [],
    apiErrors: [],
    syncRunId: "",
  };

  try {
    // 1. Create sync_runs row
    const { data: syncRun, error: syncErr } = await supabase
      .from("sync_runs")
      .insert({
        job_name: "nav_backfill",
        trigger_type: "manual",
        status: "running",
        provider: "sec",
      })
      .select("id")
      .single();

    if (syncErr) throw new Error(`Failed to create sync_run: ${syncErr.message}`);
    result.syncRunId = syncRun.id;

    // 2. Get MIN(trade_date) per fund from transactions
    const { data: txRows, error: txErr } = await supabase
      .from("transactions")
      .select("fund_id, trade_date");
    if (txErr) throw new Error(`Failed to query transactions: ${txErr.message}`);

    const earliestTxByFund = new Map<string, string>();
    for (const row of txRows ?? []) {
      const existing = earliestTxByFund.get(row.fund_id);
      if (!existing || row.trade_date < existing) {
        earliestTxByFund.set(row.fund_id, row.trade_date);
      }
    }

    if (earliestTxByFund.size === 0) {
      await supabase
        .from("sync_runs")
        .update({ status: "success", completed_at: new Date().toISOString(), processed_count: 0 })
        .eq("id", result.syncRunId);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get MIN(nav_date) per fund from nav_history
    const { data: navRows, error: navErr } = await supabase
      .from("nav_history")
      .select("fund_id, nav_date");
    if (navErr) throw new Error(`Failed to query nav_history: ${navErr.message}`);

    const earliestNavByFund = new Map<string, string>();
    for (const row of navRows ?? []) {
      const existing = earliestNavByFund.get(row.fund_id);
      if (!existing || row.nav_date < existing) {
        earliestNavByFund.set(row.fund_id, row.nav_date);
      }
    }

    // 4. Identify funds with gaps
    const fundsWithGaps: { fundId: string; requestedStart: string; endDate: string }[] = [];

    for (const [fundId, earliestTx] of earliestTxByFund) {
      const earliestNav = earliestNavByFund.get(fundId);
      if (!earliestNav) {
        // No nav_history at all — backfill from earliest tx to today
        fundsWithGaps.push({ fundId, requestedStart: earliestTx, endDate: toDateStr(new Date()) });
      } else if (earliestTx < earliestNav) {
        // Gap: tx predates nav coverage — backfill up to day before earliest nav
        fundsWithGaps.push({ fundId, requestedStart: earliestTx, endDate: toDateStr(addDays(new Date(earliestNav + "T00:00:00Z"), -1)) });
      } else {
        result.fundsSkipped++;
      }
    }

    if (fundsWithGaps.length === 0) {
      await supabase
        .from("sync_runs")
        .update({
          status: "success",
          completed_at: new Date().toISOString(),
          processed_count: 0,
          skipped_count: result.fundsSkipped,
        })
        .eq("id", result.syncRunId);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Load fund records and build projIdMap
    const fundIds = fundsWithGaps.map((g) => g.fundId);
    const { data: funds, error: fundsErr } = await supabase
      .from("funds")
      .select("id, fund_code, sec_fund_code")
      .in("id", fundIds);
    if (fundsErr) throw new Error(`Failed to load funds: ${fundsErr.message}`);

    const fundMap = new Map((funds ?? []).map((f) => [f.id, f]));

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

    console.log(`[backfill] ${fundsWithGaps.length} fund(s) with gaps, projIdMap has ${projIdMap.size} entries`);

    // 6. Process each fund
    for (const gap of fundsWithGaps) {
      const fund = fundMap.get(gap.fundId);
      if (!fund) continue;

      const lookupCode = fund.sec_fund_code ?? fund.fund_code;
      const projId = projIdMap.get(NORM(lookupCode));

      if (!projId) {
        result.unresolvedFunds.push(fund.fund_code);
        continue;
      }

      // This fund enters the resolved backfill loop
      result.fundsProcessed++;

      // Apply 365-day cap
      const endDate = new Date(gap.endDate + "T00:00:00Z");
      let actualStart = new Date(gap.requestedStart + "T00:00:00Z");
      const capStart = addDays(endDate, -(BACKFILL_CAP_DAYS - 1));

      if (actualStart < capStart) {
        actualStart = capStart;
        result.cappedFunds.push({
          fundCode: fund.fund_code,
          requestedStart: gap.requestedStart,
          actualStart: toDateStr(actualStart),
          endDate: gap.endDate,
        });
      }

      // Preload existing nav_history for this fund in date range
      const { data: existingNavRows } = await supabase
        .from("nav_history")
        .select("nav_date, nav_per_unit")
        .eq("fund_id", fund.id)
        .gte("nav_date", toDateStr(actualStart))
        .lte("nav_date", gap.endDate);

      const existingNavMap = new Map<string, number>();
      for (const row of existingNavRows ?? []) {
        existingNavMap.set(row.nav_date, Number(row.nav_per_unit));
      }

      // Iterate weekdays in range
      const current = new Date(actualStart);
      while (current <= endDate) {
        const dateStr = toDateStr(current);

        if (isWeekend(current)) {
          result.weekendsSkipped++;
          current.setDate(current.getDate() + 1);
          continue;
        }

        // Call SEC API for every weekday
        result.datesChecked++;

        try {
          const url = `https://api.sec.or.th/FundDailyInfo/${projId}/dailynav/${dateStr}`;
          const res = await fetchWithRetry(url, {
            "Ocp-Apim-Subscription-Key": secApiKey,
            Accept: "application/json",
          });

          if (res.status === 204) {
            await res.text(); // consume body
            result.noDataDates++;

            // Log inconsistency if we have an existing row for a 204 date
            if (existingNavMap.has(dateStr)) {
              console.warn(
                `[backfill] Inconsistency: SEC returned 204 for ${fund.fund_code} on ${dateStr} but nav_history has value ${existingNavMap.get(dateStr)} — leaving row unchanged`
              );
            }

            await delay(THROTTLE_MS);
            current.setDate(current.getDate() + 1);
            continue;
          }

          if (!res.ok) {
            await res.text();
            result.apiErrors.push(`${fund.fund_code}: HTTP ${res.status} on ${dateStr}`);
            await delay(THROTTLE_MS);
            current.setDate(current.getDate() + 1);
            continue;
          }

          const data = await res.json();
          const navPerUnit = parseDailyNavResponse(data);

          if (navPerUnit === null) {
            result.noDataDates++;
            await delay(THROTTLE_MS);
            current.setDate(current.getDate() + 1);
            continue;
          }

          const existingNav = existingNavMap.get(dateStr);
          const now = new Date().toISOString();

          if (existingNav !== undefined) {
            if (existingNav === navPerUnit) {
              result.rowsSkipped++;
            } else {
              const { error: updateErr } = await supabase
                .from("nav_history")
                .update({
                  nav_per_unit: navPerUnit,
                  source: "sec_th_backfill",
                  fetched_at: now,
                })
                .eq("fund_id", fund.id)
                .eq("nav_date", dateStr);
              if (updateErr) {
                result.apiErrors.push(`${fund.fund_code}: update error on ${dateStr}: ${updateErr.message}`);
              } else {
                result.rowsUpdated++;
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
            if (insertErr) {
              result.apiErrors.push(`${fund.fund_code}: insert error on ${dateStr}: ${insertErr.message}`);
            } else {
              result.rowsInserted++;
            }
          }
        } catch (err) {
          result.apiErrors.push(`${fund.fund_code}: ${(err as Error).message} on ${dateStr}`);
        }

        await delay(THROTTLE_MS);
        current.setDate(current.getDate() + 1);
      }
    }

    // 7. Rebuild portfolio snapshots if any NAV data changed
    if (result.rowsInserted > 0 || result.rowsUpdated > 0) {
      try {
        await rebuildPortfolioSnapshotsForToday(supabase);
      } catch (err) {
        const msg = `Snapshot rebuild failed: ${(err as Error).message}`;
        console.error(`[backfill] ${msg}`);
        result.apiErrors.push(msg);
      }
    }

    // 8. Update sync_runs
    const hasErrors = result.apiErrors.length > 0 || result.unresolvedFunds.length > 0;
    await supabase
      .from("sync_runs")
      .update({
        status: hasErrors ? "failed" : "success",
        completed_at: new Date().toISOString(),
        processed_count: result.fundsProcessed,
        inserted_count: result.rowsInserted,
        updated_count: result.rowsUpdated,
        skipped_count: result.fundsSkipped + result.rowsSkipped,
        error_message: hasErrors
          ? [...result.unresolvedFunds.map((f) => `Unresolved: ${f}`), ...result.apiErrors].join("; ").substring(0, 2000)
          : null,
      })
      .eq("id", result.syncRunId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = (err as Error).message;
    result.success = false;

    if (result.syncRunId) {
      await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", result.syncRunId);
    }

    return new Response(JSON.stringify({ ...result, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
