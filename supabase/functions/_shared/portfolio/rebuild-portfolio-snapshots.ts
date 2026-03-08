import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TxRow {
  fund_id: string;
  tx_type: string;
  units: number;
  amount: number;
  fee: number;
  dividend_type: string | null;
  trade_date: string;
}

/**
 * Rebuild today's portfolio snapshot using average cost method.
 * Mirrors the logic in src/lib/holdings.ts exactly.
 * Missing NAV → fall back to cost basis instead of skipping the fund.
 */
export async function rebuildPortfolioSnapshotsForToday(
  supabase: SupabaseClient
): Promise<{ latestNavDate: string | null }> {
  // Load all transactions
  const { data: transactions, error: txErr } = await supabase
    .from("transactions")
    .select("fund_id, tx_type, units, amount, fee, dividend_type, trade_date")
    .order("trade_date", { ascending: true });

  if (txErr) throw new Error(`Failed to load transactions: ${txErr.message}`);

  // Load active funds
  const { data: funds, error: fundsErr } = await supabase
    .from("funds")
    .select("id")
    .eq("is_active", true);

  if (fundsErr) throw new Error(`Failed to load funds: ${fundsErr.message}`);

  const activeFundIds = new Set(funds.map((f: { id: string }) => f.id));

  // Group transactions by fund
  const txByFund: Record<string, TxRow[]> = {};
  for (const tx of (transactions as TxRow[]) || []) {
    if (!txByFund[tx.fund_id]) txByFund[tx.fund_id] = [];
    txByFund[tx.fund_id].push(tx);
  }

  // Compute holdings per fund
  const holdingFundIds: string[] = [];
  const holdingData: Record<string, { totalUnits: number; totalCost: number }> = {};

  for (const fundId of activeFundIds) {
    const txs = txByFund[fundId] || [];
    let totalUnits = 0;
    let totalCost = 0;

    for (const tx of txs) {
      if (tx.tx_type === "buy" || tx.tx_type === "switch_in") {
        totalUnits += tx.units;
        totalCost += tx.amount + tx.fee;
      } else if (tx.tx_type === "sell" || tx.tx_type === "switch_out") {
        if (totalUnits > 0) {
          const costReduction = (tx.units / totalUnits) * totalCost;
          totalUnits -= tx.units;
          totalCost -= costReduction;
        }
        if (totalUnits <= 0.0001) {
          totalUnits = 0;
          totalCost = 0;
        }
      } else if (tx.tx_type === "dividend") {
        if (tx.dividend_type === "reinvest") {
          totalUnits += tx.units;
          totalCost += tx.amount;
        }
      }
    }

    if (totalUnits > 0) {
      holdingFundIds.push(fundId);
      holdingData[fundId] = { totalUnits, totalCost };
    }
  }

  // Load latest NAV for each holding
  let latestNavDate: string | null = null;
  let totalValue = 0;
  let totalCost = 0;

  for (const fundId of holdingFundIds) {
    const { data: navRows } = await supabase
      .from("nav_history")
      .select("nav_per_unit, nav_date")
      .eq("fund_id", fundId)
      .order("nav_date", { ascending: false })
      .limit(1);

    const nav = navRows?.[0];
    const holding = holdingData[fundId];

    if (nav) {
      // NAV available — use real market value
      totalValue += holding.totalUnits * nav.nav_per_unit;
      totalCost += holding.totalCost;

      if (!latestNavDate || nav.nav_date > latestNavDate) {
        latestNavDate = nav.nav_date;
      }
    } else {
      // Missing NAV — fall back to cost basis
      totalValue += holding.totalCost;
      totalCost += holding.totalCost;
    }
  }

  const totalGainLoss = totalValue - totalCost;
  const totalReturnPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  // Upsert today's snapshot
  const today = new Date().toISOString().substring(0, 10);

  const { error: upsertErr } = await supabase
    .from("portfolio_snapshots")
    .upsert(
      {
        snapshot_date: today,
        total_value: totalValue,
        total_cost: totalCost,
        total_gain_loss: totalGainLoss,
        total_return_percent: totalReturnPercent,
        latest_nav_date: latestNavDate,
      },
      { onConflict: "snapshot_date" }
    );

  if (upsertErr) throw new Error(`Failed to upsert snapshot: ${upsertErr.message}`);

  return { latestNavDate };
}
