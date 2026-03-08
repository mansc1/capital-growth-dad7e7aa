import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Updates transactions where nav_at_trade = 0 (placeholder) to the real NAV value
 * for the given fund_id and trade_date. Returns the count of updated rows.
 */
export async function writeBackPendingTransactions(
  supabase: SupabaseClient,
  fundId: string,
  tradeDate: string,
  navPerUnit: number
): Promise<number> {
  const { data, error } = await supabase
    .from("transactions")
    .update({ nav_at_trade: navPerUnit })
    .eq("fund_id", fundId)
    .eq("trade_date", tradeDate)
    .eq("nav_at_trade", 0)
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}
