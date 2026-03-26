import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SecApiClient, delay, THROTTLE_DELAY_MS } from "../_shared/sec-api/client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const secApiKey = Deno.env.get("SEC_API_KEY") ?? "";

  if (!secApiKey) {
    return new Response(
      JSON.stringify({ error: "SEC_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const client = new SecApiClient(secApiKey);

  try {
    // Step 1: List all AMCs
    const amcs = await client.fetchAmcList("[sync-dir]");

    let totalFunds = 0;
    let failedAmcs = 0;

    // Step 2: For each AMC, list funds and upsert in batches
    for (let i = 0; i < amcs.length; i++) {
      const amc = amcs[i];
      if (!amc.unique_id) continue;

      try {
        const funds = await client.fetchFundsByAmc(amc.unique_id, "[sync-dir]");

        if (funds.length > 0) {
          const now = new Date().toISOString();
          const rows = funds
            .filter((f) => f.proj_id && f.proj_abbr_name)
            .map((f) => ({
              proj_id: String(f.proj_id),
              proj_abbr_name: f.proj_abbr_name,
              proj_name_en: f.proj_name_en ?? null,
              proj_name_th: f.proj_name_th ?? null,
              amc_name: amc.name_en ?? amc.name_th ?? null,
              updated_at: now,
            }));

          // Upsert in chunks of 500
          for (let j = 0; j < rows.length; j += 500) {
            const chunk = rows.slice(j, j + 500);
            const { error } = await supabase
              .from("sec_fund_directory")
              .upsert(chunk, { onConflict: "proj_id" });
            if (error) {
              console.warn(`[sync-dir] Upsert error for AMC ${amc.unique_id} chunk ${j}: ${error.message}`);
            }
          }
          totalFunds += rows.length;
        }
      } catch (err) {
        console.warn(`[sync-dir] Error for AMC ${amc.unique_id}:`, (err as Error).message);
        failedAmcs++;
      }

      if (i < amcs.length - 1) {
        await delay(THROTTLE_DELAY_MS);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalAmcs: amcs.length,
        failedAmcs,
        totalFunds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
