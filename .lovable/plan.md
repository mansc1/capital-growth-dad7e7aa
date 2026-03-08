

# Implementation: Client-Side Portfolio Time Series

## File 1: CREATE `src/hooks/use-portfolio-time-series.ts`

Hook returning `{ data: PortfolioSnapshot[], isLoading: boolean }`.

Single `useQuery` with key `['portfolio_time_series', range]` that:

1. Fetches ALL transactions (sorted by `trade_date`) and ALL nav_history in parallel
2. Builds `navLookup: Map<fundId, Map<dateStr, number>>` and `txByDate: Map<dateStr, Transaction[]>` (sorted by `created_at` then `id` within each date)
3. Collects all unique dates from both, sorted ascending
4. Walks dates with `fundState: Map<fundId, { units, cost, lastKnownNav: number | null }>` and a running `latestActualNavDate: string | null`
5. Each date:
   - Apply transactions: exact `computeHoldings` logic from `src/lib/holdings.ts`:
     - buy/switch_in: `units += tx.units, cost += tx.amount + tx.fee`
     - sell/switch_out: guard `totalUnits > 0` before division, use pre-tx units for ratio: `costReduction = (tx.units / preUnits) * cost`, then subtract; if `units <= 0.0001` reset BOTH to 0
     - dividend reinvest: `units += tx.units, cost += tx.amount`; cash: no-op
   - Update carry-forward NAV only from real navLookup entries; update `latestActualNavDate` only from real NAV observations
   - Value: `lastKnownNav !== null` → `units × nav`; else → `cost` (cost-basis fallback)
   - Emit point if any fund has units > 0 AND date >= rangeStart
6. Returns `PortfolioSnapshot[]` shape with `snapshot_date` as semantic date, `latest_nav_date` from `latestActualNavDate`

## File 2: MODIFY `src/pages/Dashboard.tsx`

- Line 3: `import { usePortfolioTimeSeries } from "@/hooks/use-portfolio-time-series"`
- Line 22: `usePortfolioTimeSeries(chartRange)` replaces `usePortfolioSnapshots(chartRange)`
- Line 23: `usePortfolioTimeSeries("ALL")` replaces `usePortfolioSnapshots("ALL")`
- Lines 73, 80: derive `latestNavDate` from time series last point's `latest_nav_date`; remove `latestSnapshot`
- Lines 81-85: remove `latestSnapshot` fallback — keep only `lastSuccess?.completed_at` for `lastSyncTime`
- Stat cards, chart components, everything else unchanged

No other files changed.

