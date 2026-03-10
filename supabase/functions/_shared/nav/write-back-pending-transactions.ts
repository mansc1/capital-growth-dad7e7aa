/**
 * Write-back utility: updates transactions where nav_at_trade = 0
 * (placeholder) with the real NAV value for matching fund_id + trade_date.
 *
 * Returns the count of rows updated. 0 = no-op (silent).
 */
export async function writeBackPendingTransactions(
  supabase: { from: (table: string) => any },
  fundId: string,
  tradeDate: string,
  navPerUnit: number,
): Promise<number> {
  const { data, error } = await supabase
    .from("transactions")
    .update({ nav_at_trade: navPerUnit })
    .eq("fund_id", fundId)
    .eq("trade_date", tradeDate)
    .eq("nav_at_trade", 0)
    .select("id");

  if (error) {
    throw new Error(`write-back update failed: ${error.message}`);
  }

  return data?.length ?? 0;
}
