import { supabase } from "@/integrations/supabase/client";

/**
 * Shared gap-detection + queue insertion helper.
 * Used by transaction save, import, and manual backfill paths.
 *
 * Returns true if a backfill job was enqueued, false if coverage already exists.
 */
export async function checkAndEnqueueBackfill(
  fundId: string,
  tradeDate: string
): Promise<boolean> {
  // Normalize to YYYY-MM-DD
  const normalizedDate = tradeDate.substring(0, 10);
  const today = new Date().toISOString().substring(0, 10);

  // Check if nav_history has any record on or before trade date for this fund
  const { data: navRows, error: navErr } = await supabase
    .from("nav_history")
    .select("id")
    .eq("fund_id", fundId)
    .lte("nav_date", normalizedDate)
    .limit(1);

  if (navErr) {
    console.error("[nav-coverage] Failed to check nav_history:", navErr.message);
    return false;
  }

  // Coverage exists — no gap
  if (navRows && navRows.length > 0) {
    return false;
  }

  // Skip re-enqueue if a failed job for this fund already exists from today.
  // This prevents queue pollution from repeated failures hitting the same root cause.
  // After the underlying fix is deployed, tomorrow's transactions will re-enqueue normally.
  const todayStart = `${today}T00:00:00Z`;
  const { data: recentFailed } = await supabase
    .from("nav_backfill_queue")
    .select("id")
    .eq("fund_id", fundId)
    .eq("status", "failed")
    .gte("updated_at", todayStart)
    .limit(1);

  if (recentFailed && recentFailed.length > 0) {
    return false;
  }

  // No coverage — enqueue backfill job
  const dedupeKey = `${fundId}:${normalizedDate}:${today}`;

  const { error: insertErr } = await supabase
    .from("nav_backfill_queue")
    .insert({
      fund_id: fundId,
      requested_start_date: normalizedDate,
      requested_end_date: today,
      reason: "transaction_save",
      status: "pending",
      dedupe_key: dedupeKey,
    });

  // Silently ignore unique constraint violation (active job already exists)
  if (insertErr) {
    if (insertErr.code === "23505") {
      // Duplicate — another active job exists for this key
      return false;
    }
    console.error("[nav-coverage] Failed to enqueue backfill:", insertErr.message);
    return false;
  }

  // Fire-and-forget call to the processor
  supabase.functions.invoke("process-nav-backfill").catch((err) => {
    console.warn("[nav-coverage] Fire-and-forget invoke failed:", err);
  });

  return true;
}
