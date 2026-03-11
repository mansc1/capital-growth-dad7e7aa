

## Extend Chart Range Selector with Additional Timeframes

### Summary

Add `6M`, `YTD`, `1Y`, and `SINCE_START` ranges alongside existing `1M` and `3M`. Replace `ALL` with `SINCE_START`. This touches the type definition, a shared range-to-date helper, and all consumers.

### Changes

**1. `src/types/portfolio.ts`** — Update type:
```ts
export type ChartRange = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'SINCE_START';
```

**2. Create `src/lib/chart-range.ts`** — Shared helper to avoid duplicating logic in 6 places:
```ts
import { subMonths, subYears, startOfYear } from 'date-fns';

export function rangeToStartDate(range: ChartRange): string | null {
  const now = new Date();
  switch (range) {
    case '1M': return subMonths(now, 1).toISOString().split('T')[0];
    case '3M': return subMonths(now, 3).toISOString().split('T')[0];
    case '6M': return subMonths(now, 6).toISOString().split('T')[0];
    case 'YTD': return startOfYear(now).toISOString().split('T')[0];
    case '1Y': return subYears(now, 1).toISOString().split('T')[0];
    case 'SINCE_START': return null;
  }
}

export function rangeLabel(range: ChartRange): string {
  return range === 'SINCE_START' ? 'Since Start' : range;
}
```

**3. Update consumers** — Replace inline `range === '1M' ? 1 : 3` logic with `rangeToStartDate(range)`:

- `src/hooks/use-portfolio-time-series.ts` (line 77-79)
- `src/hooks/use-all-nav-history.ts` (line 20-22)
- `src/hooks/use-portfolio-snapshots.ts` (line 15-17)
- `src/analytics/returns.ts` — `computePortfolioTWRForRange` (line 53 type + lines 58-62)
- `src/components/dashboard/PortfolioTWRChart.tsx` (lines 22-24)
- `src/components/dashboard/FundPerformanceChart.tsx` (lines 47-48)

**4. `src/components/dashboard/PortfolioChart.tsx`** — Update ranges array and button rendering:
```ts
const ranges: ChartRange[] = ["1M", "3M", "6M", "YTD", "1Y", "SINCE_START"];
// Button label: rangeLabel(r) instead of r
```

**5. `src/pages/Dashboard.tsx`** — Change default from `"ALL"` to `"SINCE_START"`, and update the `usePortfolioTimeSeries("ALL")` call to `"SINCE_START"`.

No changes to analytics calculations, portfolio computation, or data fetching hook structure.

