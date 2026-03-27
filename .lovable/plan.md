

## Fix Dashboard Data Consistency — Single Source of Truth

### Problem
Dashboard mixes two data sources: `useHoldings()` for display values (lines 95-98) and `usePortfolioTimeSeries()` for the chart. This causes mismatches between the header number, chart points, and snapshot card.

### Solution
Derive all Dashboard display values from the snapshot time series. Keep `useHoldings()` only for allocation chart, holdings table, and the empty-state check.

### File: `src/pages/Dashboard.tsx`

**Change 1 — Derive display values from snapshots (replace lines 95-98):**

```ts
const latestSnapshot = snapshots?.[snapshots.length - 1];
const latestValue = Number(latestSnapshot?.total_value ?? 0);
const latestCost = Number(latestSnapshot?.total_cost ?? 0);
const latestGainLoss = Number(latestSnapshot?.total_gain_loss ?? 0);
const latestMwr = Number(latestSnapshot?.total_return_percent ?? 0);
```

**Change 2 — Update PortfolioChart props (lines 116-123):**

Pass `latestValue` and `latestMwr` instead of holdings-based values:

```tsx
<PortfolioChart
  snapshots={snapshots ?? []}
  isLoading={snapshotsLoading}
  range={chartRange}
  onRangeChange={setChartRange}
  latestValue={latestValue}
  returnPct={latestMwr}
/>
```

**Change 3 — Update PortfolioSnapshotCard props (lines 139-146):**

```tsx
<PortfolioSnapshotCard
  totalValue={latestValue}
  totalCost={latestCost}
  unrealizedGain={latestGainLoss}
  mwr={latestMwr}
  twr={twrPct}
  isLoading={snapshotsLoading}
/>
```

**What stays unchanged:**
- `useHoldings()` remains for: empty-state check, `heldFundIds`, `AllocationChart`, `HoldingsSummaryTable`, `FundPerformanceChart`
- All hooks, analytics, charts, and UI layout unchanged
- `PortfolioChart.tsx` and `PortfolioSnapshotCard.tsx` components unchanged (they already accept these props)

### Result
- Portfolio Value header = last chart point = last snapshot value
- Snapshot card values = same source as chart
- TWR already uses `allSnapshots` — no change needed
- Holdings page continues using `useHoldings()` independently

