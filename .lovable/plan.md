

## Fix: Dashboard Charts Stop at ~Feb 10

### Root Cause

The `nav_history` table has **1206 rows**, exceeding the default 1000-row limit. Three queries fetch this table without specifying a higher limit, so rows after ~Feb 10 are silently dropped. The chart date axis extends correctly (from transaction dates), but the NAV lookup has no data after row 1000, so portfolio values flatline.

The `use-holdings.ts` file already handles this correctly with `.limit(5000)` and a TODO comment.

### Fix — Add explicit limits to 3 queries

**File 1: `src/hooks/use-portfolio-time-series.ts`** (line 12)

Add `.limit(10000)` to the nav_history query:
```ts
supabase.from('nav_history').select('*').order('nav_date', { ascending: true }).limit(10000),
```

**File 2: `src/hooks/use-all-nav-history.ts`** (line 21, before `await`)

Add `.limit(10000)` to the query chain — feeds the Fund Performance chart.

**File 3: `src/hooks/use-nav-history.ts`** (lines 12 and 30)

Add `.limit(10000)` to both queries in `useNavHistory` and `useLatestNavs` — used by fund detail pages.

### Why this fixes all three charts

| Chart | Data source | Fix |
|---|---|---|
| Portfolio Value | `use-portfolio-time-series` → nav_history | File 1 |
| Portfolio TWR | Same snapshots from `use-portfolio-time-series` | File 1 |
| Fund Performance | `use-all-nav-history` → nav_history | File 2 |

### No other changes needed

- The daily iteration loop in `use-portfolio-time-series.ts` already correctly walks every date and carries forward NAV values
- `computePortfolioTWRSeries` and `computeFundReturnSeries` in `src/analytics/returns.ts` already process all provided data points
- The bug is purely that the input data is truncated at 1000 rows

