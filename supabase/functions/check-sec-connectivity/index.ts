import { SecApiClient } from "../_shared/sec-api/client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const client = new SecApiClient();
    const result = await SecApiClient.checkConnectivity("[check-sec-connectivity]");

    // Mask the base URL for security
    const baseUrl = Deno.env.get("SEC_API_BASE_URL") || "https://open-api.sec.or.th/v2";
    const maskedUrl = baseUrl.replace(/^(https?:\/\/[^/]+).*/, "$1/...");

    return new Response(
      JSON.stringify({
        reachable: result.reachable,
        error: result.error ?? null,
        category: result.category ?? null,
        baseUrl: maskedUrl,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    console.error("[check-sec-connectivity] unexpected error:", err);
    return new Response(
      JSON.stringify({
        reachable: false,
        error: String((err as Error).message ?? err),
        category: "unknown",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
});
