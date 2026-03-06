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

  // Determine trigger type
  let triggerType = "manual";
  try {
    const body = await req.clone().json();
    if (body?.trigger_type) triggerType = body.trigger_type;
  } catch { /* no body is fine */ }

  // Auth
  const cronSecretHeader = req.headers.get("x-cron-secret") ?? "";
  if (!cronSecret || cronSecretHeader !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Resolve provider early so we know the name even if construction throws
  let providerName = "unknown";
  let providerInstance: ReturnType<typeof getNavProvider>["provider"] | null = null;

  try {
    const result = getNavProvider();
    providerInstance = result.provider;
    providerName = result.providerName;
  } catch (providerErr) {
    // Provider construction failed (e.g. missing SEC_API_KEY)
    const errorMsg = (providerErr as Error).message;
    // Try to determine provider name from env even on failure
    providerName = Deno.env.get("NAV_PROVIDER") ?? "unknown";

    // Still create a sync_runs row so the failure is visible
    try {
      await supabase.from("sync_runs").insert({
        job_name: "nav_sync",
        trigger_type: triggerType,
        status: "failed",
        provider: providerName,
        completed_at: new Date().toISOString(),
        error_message: errorMsg,
      });
    } catch { /* best effort */ }

    return new Response(
      JSON.stringify({
        success: false,
        processedFunds: 0,
        insertedRows: 0,
        updatedRows: 0,
        skippedFunds: 0,
        latestNavDate: null,
        syncRunId: null,
        provider: providerName,
        errors: [errorMsg],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let syncRunId = "";
  const errors: string[] = [];
  let processedFunds = 0;
  let insertedRows = 0;
  let updatedRows = 0;
  let skippedFunds = 0;
  let latestNavDate: string | null = null;

  try {
    // 1. Create sync_runs row immediately
    const { data: syncRun, error: syncErr } = await supabase
      .from("sync_runs")
      .insert({
        job_name: "nav_sync",
        trigger_type: triggerType,
        status: "running",
        provider: providerName,
      })
      .select("id")
      .single();

    if (syncErr) throw new Error(`Failed to create sync_run: ${syncErr.message}`);
    syncRunId = syncRun.id;

    // 2. Load active funds (including sec_fund_code for lookup)
    const { data: funds, error: fundsErr } = await supabase
      .from("funds")
      .select("id, fund_code, sec_fund_code")
      .eq("is_active", true);

    if (fundsErr) throw new Error(`Failed to load funds: ${fundsErr.message}`);
    if (!funds || funds.length === 0) {
      await supabase
        .from("sync_runs")
        .update({ status: "success", completed_at: new Date().toISOString(), processed_count: 0, provider: providerName })
        .eq("id", syncRunId);

      return new Response(
        JSON.stringify({ success: true, processedFunds: 0, insertedRows: 0, updatedRows: 0, skippedFunds: 0, latestNavDate: null, syncRunId, provider: providerName, errors: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Build lookup codes from original fund records
    // Each fund's external lookup code is sec_fund_code (if set), otherwise fund_code
    const fundLookupCodes = funds.map((f) => ({
      fund: f,
      lookupCode: f.sec_fund_code ?? f.fund_code,
    }));

    // Collect unique codes for provider call
    const uniqueLookupCodes = [...new Set(fundLookupCodes.map((flc) => flc.lookupCode))];

    let navResults;
    try {
      navResults = await providerInstance!.fetchLatestNavForFunds(uniqueLookupCodes);
    } catch (providerErr) {
      const errorMsg = `Provider "${providerName}" failed: ${(providerErr as Error).message}`;
      await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errorMsg,
          provider: providerName,
        })
        .eq("id", syncRunId);

      return new Response(
        JSON.stringify({ success: false, processedFunds: 0, insertedRows: 0, updatedRows: 0, skippedFunds: 0, latestNavDate: null, syncRunId, provider: providerName, errors: [errorMsg] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Index results by fundCode for quick access
    const resultsByCode = new Map(navResults.map((r) => [r.fundCode, r]));

    // 4. Process each fund using original fund record for identity
    for (const { fund, lookupCode } of fundLookupCodes) {
      processedFunds++;
      const navResult = resultsByCode.get(lookupCode);

      if (!navResult) {
        skippedFunds++;
        errors.push(`No NAV data returned for ${fund.fund_code} (lookup: ${lookupCode})`);
        continue;
      }

      if (!navResult.navDate || isNaN(navResult.navPerUnit) || navResult.navPerUnit <= 0) {
        skippedFunds++;
        errors.push(`Invalid NAV data for ${fund.fund_code} (lookup: ${lookupCode})`);
        continue;
      }

      try {
        const { data: existing } = await supabase
          .from("nav_history")
          .select("id, nav_per_unit")
          .eq("fund_id", fund.id)
          .eq("nav_date", navResult.navDate)
          .maybeSingle();

        const now = new Date().toISOString();

        if (existing) {
          if (existing.nav_per_unit === navResult.navPerUnit) {
            skippedFunds++;
          } else {
            const { error: updateErr } = await supabase
              .from("nav_history")
              .update({ nav_per_unit: navResult.navPerUnit, source: navResult.source, fetched_at: now, updated_at: now })
              .eq("id", existing.id);
            if (updateErr) throw updateErr;
            updatedRows++;
          }
        } else {
          const { error: insertErr } = await supabase
            .from("nav_history")
            .insert({ fund_id: fund.id, nav_date: navResult.navDate, nav_per_unit: navResult.navPerUnit, source: navResult.source, fetched_at: now });
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
        provider: providerName,
      })
      .eq("id", syncRunId);

    return new Response(
      JSON.stringify({ success: errors.length === 0, processedFunds, insertedRows, updatedRows, skippedFunds, latestNavDate, syncRunId, provider: providerName, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = (err as Error).message;
    if (syncRunId) {
      await supabase
        .from("sync_runs")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: message, provider: providerName })
        .eq("id", syncRunId);
    }

    return new Response(
      JSON.stringify({ success: false, processedFunds, insertedRows, updatedRows, skippedFunds, latestNavDate, syncRunId, provider: providerName, errors: [message, ...errors] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
