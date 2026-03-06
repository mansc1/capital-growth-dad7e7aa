

# Implementation Plan: TWR Charts & Fund Performance Comparison

## Summary
Remove TopPerformers, add Portfolio TWR chart and Fund Performance multi-line chart. New dashboard order: Portfolio Value → Portfolio TWR → Fund Performance → StatCards → Allocation + Holdings table.

## Files to Create

### 1. `src/analytics/returns.ts` — Add two series helpers

**`computePortfolioTWRSeries(snapshots, startDate?)`**
- Sort snapshots by date, filter by startDate
- Build cumulative TWR array: `{ date, twrPct, value, dailyReturnPct }`
- First point has twrPct=0, then `product *= (1 + dailyReturn)`, `twrPct = (product-1)*100`

**`computeFundReturnSeries(navHistory, heldFundIds, fundIdToCode, startDate?)`**
- Group NAV by fund_id, filter to heldFundIds only
- For each fund: filter by startDate, normalize from first NAV: `(NAV/NAV_start - 1) * 100`
- Skip funds with <2 data points in range
- Merge all funds into unified date rows: `{ date, [fundCode]: returnPct }`
- Return `{ data: row[], fundCodes: string[] }`

### 2. `src/hooks/use-all-nav-history.ts`
- Fetches all NAV history with optional date range filter based on ChartRange
- Query key: `['all_nav_history', range]`

### 3. `src/components/dashboard/PortfolioTWRChart.tsx`
- AreaChart showing cumulative TWR (%) over time
- Y-axis in percentage, tooltip: date, TWR%, value, daily return%
- Empty state if <2 data points

### 4. `src/components/dashboard/FundPerformanceChart.tsx`
- Multi-line LineChart, one Line per held fund
- Uses `hsl(var(--chart-1))` through `--chart-5` for colors
- Clickable legend toggles line visibility (local state)
- Sorted alphabetically by fund_code
- Tooltip: date + each fund return%
- Clean empty state if no funds have sufficient data

## Files to Modify

### 5. `src/pages/Dashboard.tsx`
- Remove TopPerformers import/usage
- Add imports for new charts + `useAllNavHistory`
- Build `heldFundIds` and `fundIdToCode` from holdings
- New order: PortfolioChart → PortfolioTWRChart → FundPerformanceChart → StatCards → Allocation+Holdings → footer

## Files to Delete

### 6. `src/components/dashboard/TopPerformers.tsx`
- No longer needed

## No database changes required.

