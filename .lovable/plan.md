

# Fix: Extend Charts to Today's Date

## Problem

1. **Portfolio TWR chart** ends at the last NAV observation date, not today. The time series generator (`use-portfolio-time-series.ts` line 56) uses the last data date as `endDateStr`.
2. **Fund Performance chart** ends at the last NAV date and doesn't anchor to the first transaction date. The `computeFundReturnSeries` function only iterates dates present in `navHistory`.

## Fix

### 1. `src/hooks/use-portfolio-time-series.ts` — Extend end date to today

**Line 56**: Change `endDateStr` from `sortedUnique[sortedUnique.length - 1]` to `max(lastDataDate, today)`.

```ts
const today = new Date().toISOString().split('T')[0];
const endDateStr = today > sortedUnique[sortedUnique.length - 1]
  ? today
  : sortedUnique[sortedUnique.length - 1];
```

This extends the daily loop to today, carrying forward the last known NAV values for days without new data. The existing carry-forward logic already handles this correctly.

### 2. `src/analytics/returns.ts` — `computeFundReturnSeries`: extend to today with carry-forward

After collecting all dates from `navHistory`, add today's date to `allDates` so the chart extends to the current date. The existing carry-forward (`lastKnown`) logic already fills gaps.

```ts
const today = new Date().toISOString().split('T')[0];
allDates.add(today);
```

### 3. `src/components/dashboard/FundPerformanceChart.tsx` — Pass first transaction date

Pass the earliest transaction date from `holdings` as the start date for the "ALL" range, so the chart begins from the first buy rather than the first NAV observation.

Currently `startDate` is `undefined` for ALL range. Instead, compute the earliest transaction date from holdings and pass it. However, `holdings` doesn't directly expose first transaction date — the `navHistory` data already starts from the first available NAV which typically aligns with the first transaction's backfill.

Actually, the real issue is just that the chart doesn't reach today. The start date from the screenshot (27 Mar) already looks correct — it starts from the first NAV data. The main fix is extending the end date to today.

## Summary of Changes

| File | Change |
|------|--------|
| `src/hooks/use-portfolio-time-series.ts` | Extend `endDateStr` to today |
| `src/analytics/returns.ts` | Add today to `allDates` in `computeFundReturnSeries` |

Two small edits, no schema or pipeline changes.

