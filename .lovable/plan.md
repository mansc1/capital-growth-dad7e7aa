

## Add Actual vs Projected Overlay to Retirement Chart

### Summary

Overlay actual portfolio values as bars on the existing retirement projection chart. The actual data comes from the existing `usePortfolioTimeSeries` hook, converted from dates to ages using the user's birth year.

### Changes

**1. `src/pages/RetirementPlanner.tsx`** — Fetch actual portfolio data and pass to chart

- Import `usePortfolioTimeSeries` hook
- Compute `actualByAge`: take time series data, convert `snapshot_date` to age using `input.birthYear`, group by year (take last value per year), produce `Map<number, number>` of age → total_value
- Only include ages ≤ current age (based on current year - birthYear)
- Pass `actualByAge` to `RetirementChart` and `ProjectionSheet` via `chartProps`

**2. `src/components/retirement/RetirementChart.tsx`** — Add bar overlay

Props change:
- Add optional `actualByAge?: Map<number, number>` prop

Chart data merge (in `chartData` useMemo, non-comparison mode):
- For each row, add `actual_balance: actualByAge?.get(row.age) ?? undefined`
- Only set the field when a value exists (so bars only render for ages with data)

Chart rendering:
- Switch from `LineChart` to `ComposedChart` (from recharts) to support both Line and Bar
- Add `<Bar dataKey="actual_balance" fill="hsl(221, 83%, 53% / 0.25)" barSize={12} name="Actual" />` rendered before the Line so line draws on top
- Rename existing line `name` to "Projected"
- Add `<Legend />` in non-comparison mode when actual data exists

Tooltip update:
- In non-comparison `CustomTooltip`, after existing rows, add:
  - If `row.actual_balance` exists: show "Actual: ฿X" row
  - Show "Difference: ฿X" (actual - projected, with +/- sign)

**3. Comparison mode handling**
- When comparison mode is on, hide the actual bars (keep chart simple)
- `actualByAge` is only used in non-comparison rendering

### Technical Details

- `ComposedChart` is a drop-in replacement for `LineChart` in recharts — same API, supports mixed series types
- Bar color uses the same blue as projected line but at 25% opacity for visual subordination
- No new API calls — `usePortfolioTimeSeries('SINCE_START')` reuses existing cached query
- Current age = `new Date().getFullYear() - birthYear`
- Year-to-age conversion: `year - birthYear` where `year = parseInt(snapshot_date.slice(0, 4))`

### What stays unchanged
- Simulation logic, all retirement calculations
- Comparison mode rendering (bars hidden)
- Dashboard, Holdings, Transactions
- All hooks and analytics logic

