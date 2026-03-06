import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const THROTTLE_MS = 200;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;

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
          await delay(BACKOFF_BASE_MS * Math.pow(2, attempt));
          continue;
        }
      }
      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err as Error;
      if (attempt < retries) {
        await delay(BACKOFF_BASE_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }
  throw lastError ?? new Error(`fetchWithRetry failed for ${url}`);
}

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
  const apiHeaders = {
    "Ocp-Apim-Subscription-Key": secApiKey,
    Accept: "application/json",
  };

  try {
    // Step 1: List all AMCs
    const amcRes = await fetchWithRetry("https://api.sec.or.th/FundFactsheet/fund/amc", apiHeaders);
    if (!amcRes.ok) {
      const body = await amcRes.text();
      throw new Error(`Failed to list AMCs: HTTP ${amcRes.status} — ${body.substring(0, 200)}`);
    }

    const amcs = (await amcRes.json()) as Array<{ unique_id: string; name_en?: string; name_th?: string }>;
    if (!Array.isArray(amcs) || amcs.length === 0) {
      throw new Error("AMC list is empty");
    }

    let totalFunds = 0;
    let failedAmcs = 0;

    // Step 2: For each AMC, list funds and upsert in batches
    for (let i = 0; i < amcs.length; i++) {
      const amc = amcs[i];
      if (!amc.unique_id) continue;

      try {
        const fundRes = await fetchWithRetry(
          `https://api.sec.or.th/FundFactsheet/fund/amc/${amc.unique_id}`,
          apiHeaders,
        );

        if (!fundRes.ok) {
          console.warn(`Failed to list funds for AMC ${amc.unique_id}: HTTP ${fundRes.status}`);
          await fundRes.text();
          failedAmcs++;
          continue;
        }

        const funds = (await fundRes.json()) as Array<{
          proj_id: string;
          proj_abbr_name: string;
          proj_name_en?: string;
          proj_name_th?: string;
        }>;

        if (Array.isArray(funds) && funds.length > 0) {
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
              console.warn(`Upsert error for AMC ${amc.unique_id} chunk ${j}: ${error.message}`);
            }
          }
          totalFunds += rows.length;
        }
      } catch (err) {
        console.warn(`Error for AMC ${amc.unique_id}:`, (err as Error).message);
        failedAmcs++;
      }

      if (i < amcs.length - 1) {
        await delay(THROTTLE_MS);
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
