import type { Transaction, Fund, Holding } from '@/types/portfolio';

/**
 * Compute holdings using Average Cost Method.
 * - Buy/Switch In: total_units += units, total_cost += amount + fee
 * - Sell/Switch Out: cost_reduction = (sell_units / total_units) × total_cost; total_units -= units, total_cost -= cost_reduction
 * - Dividend (cash): no unit/cost change
 * - Dividend (reinvest): total_units += units, total_cost += amount
 * - When total_units reaches zero: reset avg_cost and total_cost to 0
 */
export function computeHoldings(
  funds: Fund[],
  transactions: { fund_id: string; tx_type: string; units: number; amount: number; fee: number; dividend_type: string | null; trade_date: string }[],
  latestNavs: Record<string, { nav_per_unit: number; nav_date: string }>,
  includeZero = false
): Holding[] {
  // Group transactions by fund, sorted chronologically
  const txByFund: Record<string, typeof transactions> = {};
  for (const tx of transactions) {
    if (!txByFund[tx.fund_id]) txByFund[tx.fund_id] = [];
    txByFund[tx.fund_id].push(tx);
  }

  // Sort each fund's transactions by date
  for (const fid in txByFund) {
    txByFund[fid].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  }

  const holdings: Holding[] = [];
  let totalMarketValue = 0;

  // First pass: compute units and costs
  const fundData: { fund: Fund; total_units: number; total_cost: number; latest_nav: number }[] = [];

  for (const fund of funds) {
    const txs = txByFund[fund.id] || [];
    let totalUnits = 0;
    let totalCost = 0;

    for (const tx of txs) {
      const type = tx.tx_type;
      if (type === 'buy' || type === 'switch_in') {
        totalUnits += tx.units;
        totalCost += tx.amount + tx.fee;
      } else if (type === 'sell' || type === 'switch_out') {
        if (totalUnits > 0) {
          const costReduction = (tx.units / totalUnits) * totalCost;
          totalUnits -= tx.units;
          totalCost -= costReduction;
        }
        if (totalUnits <= 0.0001) {
          totalUnits = 0;
          totalCost = 0;
        }
      } else if (type === 'dividend') {
        if (tx.dividend_type === 'reinvest') {
          totalUnits += tx.units;
          totalCost += tx.amount;
        }
        // cash: no change
      }
    }

    const latestNav = latestNavs[fund.id]?.nav_per_unit ?? 0;
    const marketValue = totalUnits * latestNav;
    totalMarketValue += marketValue;

    if (totalUnits > 0 || includeZero) {
      fundData.push({ fund, total_units: totalUnits, total_cost: totalCost, latest_nav: latestNav });
    }
  }

  // Second pass: compute allocation %
  for (const fd of fundData) {
    const marketValue = fd.total_units * fd.latest_nav;
    const gainLoss = marketValue - fd.total_cost;
    const returnPct = fd.total_cost > 0 ? (gainLoss / fd.total_cost) * 100 : 0;
    const allocationPct = totalMarketValue > 0 ? (marketValue / totalMarketValue) * 100 : 0;

    holdings.push({
      fund: fd.fund,
      total_units: fd.total_units,
      total_cost: fd.total_cost,
      avg_cost: fd.total_units > 0 ? fd.total_cost / fd.total_units : 0,
      latest_nav: fd.latest_nav,
      market_value: marketValue,
      gain_loss: gainLoss,
      return_pct: returnPct,
      allocation_pct: allocationPct,
    });
  }

  return holdings;
}

export function getCurrentUnits(
  transactions: { tx_type: string; units: number; dividend_type: string | null }[],
  fundId: string,
  allTransactions: { fund_id: string; tx_type: string; units: number; dividend_type: string | null; trade_date: string }[]
): number {
  const txs = allTransactions
    .filter(t => t.fund_id === fundId)
    .sort((a, b) => a.trade_date.localeCompare(b.trade_date));

  let totalUnits = 0;
  for (const tx of txs) {
    if (tx.tx_type === 'buy' || tx.tx_type === 'switch_in') {
      totalUnits += tx.units;
    } else if (tx.tx_type === 'sell' || tx.tx_type === 'switch_out') {
      totalUnits -= tx.units;
    } else if (tx.tx_type === 'dividend' && tx.dividend_type === 'reinvest') {
      totalUnits += tx.units;
    }
  }
  return Math.max(0, totalUnits);
}
