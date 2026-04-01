import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SecApiClient } from "../_shared/sec-api/client.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Safely extract a response body snippet for debugging. */
async function safeBodySnippet(res: Response, maxLen = 200): Promise<string> {
  try {
    const text = await res.text();
    return text.substring(0, maxLen);
  } catch {
    return "(could not read response body)";
  }
}

/**
 * Gap detection: find funds whose earliest transaction predates nav_history coverage,
 * then enqueue backfill jobs. Well-factored for future optimization.
 */
async function detectAndEnqueueBackfill(
  supabase: ReturnType<typeof createClient>,
  warnings: string[],
): Promise<{ backfillJobsEnqueued: number }> {
  // 1. Load all transactions (fund_id, trade_date)
  const { data: txRows, error: txErr } = await supabase
    .from("transactions")
    .select("fund_id, trade_date");

  if (txErr) {
    warnings.push(`Gap detection failed: could not query transactions — ${txErr.message}`);
    warnings.push("Historical NAV coverage may be incomplete for some funds.");
    return { backfillJobsEnqueued: 0 };
  }

  if (!txRows || txRows.length === 0) {
    return { backfillJobsEnqueued: 0 };
  }

  // 2. Group by fund_id → earliest trade_date (YYYY-MM-DD)
  const earliestByFund = new Map<string, string>();
  for (const row of txRows) {
    const fundId = row.fund_id as string;
    const tradeDate = (row.trade_date as string).substring(0, 10);
    const current = earliestByFund.get(fundId);
    if (!current || tradeDate < current) {
      earliestByFund.set(fundId, tradeDate);
    }
  }

  const today = new Date().toISOString().substring(0, 10);
  const todayStart = `${today}T00:00:00Z`;
  let backfillJobsEnqueued = 0;
  let enqueueFailed = false;

  // 3. For each fund, check coverage and enqueue if needed
  for (const [fundId, earliestDate] of earliestByFund) {
    // Check if nav_history has any record on or before earliest trade date
    const { data: navRows, error: navErr } = await supabase
      .from("nav_history")
      .select("id")
      .eq("fund_id", fundId)
      .lte("nav_date", earliestDate)
      .limit(1);

    if (navErr) {
      warnings.push(`Gap detection: nav_history query failed for fund ${fundId} — ${navErr.message}`);
      enqueueFailed = true;
      continue;
    }

    // Coverage exists
    if (navRows && navRows.length > 0) {
      continue;
    }

    // Skip if a failed job from today already exists
    const { data: recentFailed } = await supabase
      .from("nav_backfill_queue")
      .select("id")
      .eq("fund_id", fundId)
      .eq("status", "failed")
      .gte("updated_at", todayStart)
      .limit(1);

    if (recentFailed && recentFailed.length > 0) {
      continue;
    }

    // Enqueue backfill job
    const dedupeKey = `${fundId}:${earliestDate}:${today}`;

    const { error: insertErr } = await supabase
      .from("nav_backfill_queue")
      .insert({
        fund_id: fundId,
        requested_start_date: earliestDate,
        requested_end_date: today,
        reason: "update_nav_data",
        status: "pending",
        dedupe_key: dedupeKey,
      });

    if (insertErr) {
      // Silently ignore dedupe collision
      if (insertErr.code === "23505") {
        continue;
      }
      warnings.push(`Gap detection: failed to enqueue backfill for fund ${fundId} — ${insertErr.message}`);
      enqueueFailed = true;
      continue;
    }

    backfillJobsEnqueued++;
  }

  if (enqueueFailed) {
    warnings.push("Historical NAV coverage may be incomplete for some funds.");
  }

  return { backfillJobsEnqueued };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const cronSecret = Deno.env.get("NAV_SYNC_CRON_SECRET") ?? "";

  // No additional auth check — verify_jwt=false in config.toml,
  // consistent with single-user app architecture.

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const warnings: string[] = [];
  const messageParts: string[] = [];

  // ── Step 1: Directory refresh ──
  let directoryRefreshed = false;
  let directoryFunds = 0;

  try {
    const dirRes = await fetch(`${supabaseUrl}/functions/v1/sync-sec-fund-directory`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!dirRes.ok) {
      const snippet = await safeBodySnippet(dirRes);
      warnings.push(`Directory refresh failed: HTTP ${dirRes.status} — ${snippet}`);
      messageParts.push("Directory refresh failed.");
    } else {
      const dirData = await dirRes.json();
      if (dirData?.success) {
        directoryRefreshed = true;
        directoryFunds = dirData.totalFunds ?? 0;
        messageParts.push(`Directory refreshed (${directoryFunds} funds).`);
      } else {
        warnings.push(`Directory refresh returned error: ${dirData?.error ?? "unknown"}`);
        messageParts.push("Directory refresh failed.");
      }
    }
  } catch (err) {
    warnings.push(`Directory refresh exception: ${(err as Error).message}`);
    messageParts.push("Directory refresh failed.");
  }

  // ── Step 2: NAV sync ──
  let navSyncRan = false;
  let insertedRows = 0;
  let updatedRows = 0;
  let skippedFunds = 0;

  try {
    const syncRes = await fetch(`${supabaseUrl}/functions/v1/sync-nav`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
        apikey: anonKey,
      },
      body: JSON.stringify({ trigger_type: "manual" }),
    });

    if (!syncRes.ok) {
      const snippet = await safeBodySnippet(syncRes);
      warnings.push(`NAV sync failed: HTTP ${syncRes.status} — ${snippet}`);
      messageParts.push("NAV sync failed.");
    } else {
      const syncData = await syncRes.json();
      if (syncData?.success) {
        navSyncRan = true;
        insertedRows = syncData.insertedRows ?? 0;
        updatedRows = syncData.updatedRows ?? 0;
        skippedFunds = syncData.skippedFunds ?? 0;
        messageParts.push(`NAV synced (${insertedRows} inserted, ${updatedRows} updated).`);
      } else {
        const errMsg = (syncData?.errors ?? []).join("; ") || "unknown error";
        warnings.push(`NAV sync returned errors: ${errMsg}`);
        messageParts.push("NAV sync failed.");
      }
    }
  } catch (err) {
    warnings.push(`NAV sync exception: ${(err as Error).message}`);
    messageParts.push("NAV sync failed.");
  }

  // ── Step 3: Gap detection & backfill enqueue ──
  const { backfillJobsEnqueued } = await detectAndEnqueueBackfill(supabase, warnings);

  if (backfillJobsEnqueued > 0) {
    messageParts.push(`${backfillJobsEnqueued} backfill job${backfillJobsEnqueued !== 1 ? "s" : ""} queued.`);
  } else {
    messageParts.push("No historical gaps detected.");
  }

  // ── Step 4: Trigger processor ──
  let backfillProcessingTriggered = false;

  if (backfillJobsEnqueued > 0) {
    try {
      const procRes = await fetch(`${supabaseUrl}/functions/v1/process-nav-backfill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
        },
      });

      if (procRes.ok) {
        backfillProcessingTriggered = true;
      } else {
        const snippet = await safeBodySnippet(procRes);
        warnings.push(
          `Backfill jobs were enqueued but the processor could not be triggered: HTTP ${procRes.status} — ${snippet}. Jobs will be picked up on the next scheduled run.`
        );
      }
    } catch (err) {
      warnings.push(
        `Backfill jobs were enqueued but the processor could not be triggered: ${(err as Error).message}. Jobs will be picked up on the next scheduled run.`
      );
    }
  }

  const success = navSyncRan || directoryRefreshed;
  const message = messageParts.join(" ");

  return new Response(
    JSON.stringify({
      success,
      message,
      warnings,
      directoryRefreshed,
      directoryFunds,
      navSyncRan,
      insertedRows,
      updatedRows,
      skippedFunds,
      backfillJobsEnqueued,
      backfillProcessingTriggered,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
