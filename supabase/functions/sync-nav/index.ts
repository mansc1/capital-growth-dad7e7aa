import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getNavProvider } from "../_shared/nav/fetch-latest-nav.ts";
import { rebuildPortfolioSnapshotsForToday } from "../_shared/portfolio/rebuild-portfolio-snapshots.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("NAV_SYNC_CRON_SECRET") ?? "";

  // Determine trigger type from body
  let triggerType = "manual";
  try {
    const body = await req.clone().json();
    if (body?.trigger_type) triggerType = body.trigger_type;
  } catch { /* no body is fine */ }

  // Auth: validate x-cron-secret for both cron and manual triggers
  const cronSecretHeader = req.headers.get("x-cron-secret") ?? "";

  if (!cronSecret || cronSecretHeader !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use service role client for all DB operations
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let syncRunId = "";
  const errors: string[] = [];
  let processedFunds = 0;
  let insertedRows = 0;
  let updatedRows = 0;
  let skippedFunds = 0;
  let latestNavDate: string | null = null;

  try {
    // 1. Create sync_runs row
    const { data: syncRun, error: syncErr } = await supabase
      .from("sync_runs")
      .insert({
        job_name: "nav_sync",
        trigger_type: triggerType,
        status: "running",
      })
      .select("id")
      .single();

    if (syncErr) throw new Error(`Failed to create sync_run: ${syncErr.message}`);
    syncRunId = syncRun.id;

    // 2. Load active funds
    const { data: funds, error: fundsErr } = await supabase
      .from("funds")
      .select("id, fund_code")
      .eq("is_active", true);

    if (fundsErr) throw new Error(`Failed to load funds: ${fundsErr.message}`);
    if (!funds || funds.length === 0) {
      await supabase
        .from("sync_runs")
        .update({ status: "success", completed_at: new Date().toISOString(), processed_count: 0 })
        .eq("id", syncRunId);

      return new Response(
        JSON.stringify({ success: true, processedFunds: 0, insertedRows: 0, updatedRows: 0, skippedFunds: 0, latestNavDate: null, syncRunId, errors: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build fund_code -> fund_id map
    const codeToId: Record<string, string> = {};
    for (const f of funds) {
      codeToId[f.fund_code] = f.id;
    }

    // 3. Fetch NAV data
    const provider = getNavProvider();
    const fundCodes = funds.map((f: { fund_code: string }) => f.fund_code);
    const navResults = await provider.fetchLatestNavForFunds(fundCodes);

    // Build lookup of fetched results
    const fetchedCodes = new Set(navResults.map((r) => r.fundCode));

    // 4. Process each fund
    for (const fund of funds) {
      processedFunds++;
      const navResult = navResults.find((r) => r.fundCode === fund.fund_code);

      if (!navResult) {
        skippedFunds++;
        if (!fetchedCodes.has(fund.fund_code)) {
          errors.push(`No NAV data returned for ${fund.fund_code}`);
        }
        continue;
      }

      const fundId = codeToId[navResult.fundCode];
      if (!fundId) {
        skippedFunds++;
        errors.push(`No fund_id match for code ${navResult.fundCode}`);
        continue;
      }

      if (!navResult.navDate || isNaN(navResult.navPerUnit) || navResult.navPerUnit <= 0) {
        skippedFunds++;
        errors.push(`Invalid NAV data for ${navResult.fundCode}`);
        continue;
      }

      try {
        // Check existing row for explicit counting
        const { data: existing } = await supabase
          .from("nav_history")
          .select("id, nav_per_unit")
          .eq("fund_id", fundId)
          .eq("nav_date", navResult.navDate)
          .maybeSingle();

        const now = new Date().toISOString();

        if (existing) {
          if (existing.nav_per_unit === navResult.navPerUnit) {
            // Same NAV, skip
            skippedFunds++;
          } else {
            // Different NAV, update
            const { error: updateErr } = await supabase
              .from("nav_history")
              .update({
                nav_per_unit: navResult.navPerUnit,
                source: navResult.source,
                fetched_at: now,
                updated_at: now,
              })
              .eq("id", existing.id);

            if (updateErr) throw updateErr;
            updatedRows++;
          }
        } else {
          // New row, insert
          const { error: insertErr } = await supabase
            .from("nav_history")
            .insert({
              fund_id: fundId,
              nav_date: navResult.navDate,
              nav_per_unit: navResult.navPerUnit,
              source: navResult.source,
              fetched_at: now,
            });

          if (insertErr) throw insertErr;
          insertedRows++;
        }

        if (!latestNavDate || navResult.navDate > latestNavDate) {
          latestNavDate = navResult.navDate;
        }
      } catch (err) {
        errors.push(`Error upserting NAV for ${fund.fund_code}: ${(err as Error).message}`);
      }
    }

    // 5. Rebuild portfolio snapshot
    try {
      const snapshotResult = await rebuildPortfolioSnapshotsForToday(supabase);
      if (snapshotResult.latestNavDate && (!latestNavDate || snapshotResult.latestNavDate > latestNavDate)) {
        latestNavDate = snapshotResult.latestNavDate;
      }
    } catch (err) {
      errors.push(`Snapshot rebuild failed: ${(err as Error).message}`);
    }

    // 6. Update sync_runs
    const finalStatus = errors.length > 0 ? "failed" : "success";
    await supabase
      .from("sync_runs")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        processed_count: processedFunds,
        inserted_count: insertedRows,
        updated_count: updatedRows,
        skipped_count: skippedFunds,
        error_message: errors.length > 0 ? errors.join("; ") : null,
      })
      .eq("id", syncRunId);

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        processedFunds,
        insertedRows,
        updatedRows,
        skippedFunds,
        latestNavDate,
        syncRunId,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = (err as Error).message;
    // Try to mark sync_run as failed
    if (syncRunId) {
      await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", syncRunId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        processedFunds,
        insertedRows,
        updatedRows,
        skippedFunds,
        latestNavDate,
        syncRunId,
        errors: [message, ...errors],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
