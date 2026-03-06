import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, anonKey);

  let query = "";
  try {
    const body = await req.json();
    query = (body?.query ?? "").trim();
  } catch {
    // try URL params
    const url = new URL(req.url);
    query = (url.searchParams.get("query") ?? "").trim();
  }

  if (query.length < 2) {
    return new Response(
      JSON.stringify({ results: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Use ILIKE for simple pattern matching
  const pattern = `%${query}%`;
  const { data, error } = await supabase
    .from("sec_fund_directory")
    .select("proj_id, proj_abbr_name, proj_name_en, proj_name_th, amc_name")
    .or(`proj_abbr_name.ilike.${pattern},proj_name_en.ilike.${pattern},proj_name_th.ilike.${pattern}`)
    .order("proj_abbr_name")
    .limit(20);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ results: data ?? [] }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
