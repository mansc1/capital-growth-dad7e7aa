

## Refactor Dashboard Metrics into "Portfolio Snapshot" Card

### Changes

**1. Create `src/components/dashboard/PortfolioSnapshotCard.tsx`**

Single Card with three sections:

- **Hero**: Total Value in `text-3xl font-bold`, "Current Portfolio Value" label below
- **Middle row** (2-col grid, separated by a Separator): Total Cost | Unrealized Gain (gain/loss colored)
- **Bottom row** (2-col grid): MWR with tooltip | TWR with tooltip (gain/loss colored, "—" fallback for TWR)
- Loading state: single Card with skeleton placeholders
- Uses existing `formatCurrency`, `formatPercent`, `gainLossColor` from `@/lib/format`
- Preserves Info tooltips for MWR/TWR from current StatCards

Props:
```ts
interface Props {
  totalValue: number;
  totalCost: number;
  unrealizedGain: number;
  mwr: number;
  twr?: number;
  isLoading: boolean;
}
```

**2. Update `src/pages/Dashboard.tsx`**

- Replace `StatCards` import with `PortfolioSnapshotCard`
- Replace lines 139-146 with:
```tsx
<PortfolioSnapshotCard
  totalValue={totalValue}
  totalCost={totalCost}
  unrealizedGain={totalGainLoss}
  mwr={totalReturnPct}
  twr={twrPct}
  isLoading={holdingsLoading}
/>
```

No other files changed. No analytics/hooks modifications.

