

# Fix Dashboard Chart Pipeline

## Root Cause

`allDates` in `use-portfolio-time-series.ts` is built only from transaction dates and NAV dates. If the first transaction is Jan 10 but NAV only starts Jan 12, dates Jan 10-11 are missing from the set — no snapshots are emitted for those days despite holdings existing. This means the pipeline can produce 0-1 snapshots, causing blank charts.

The cost-basis fallback logic (line 129-134) already exists and works correctly. The problem is purely that intermediate calendar dates are never visited.

## Changes

### 1. `src/hooks/use-portfolio-time-series.ts` — Fill daily dates

After building `allDates` from the union of tx + NAV dates (line 51), replace with a continuous daily sequence from the earliest date to the latest date. This ensures every calendar day is visited when holdings exist.

```typescript
// Replace lines 47-51
const dateSet = new Set<string>();
for (const tx of txData) dateSet.add(tx.trade_date);
for (const row of navData) dateSet.add(row.nav_date);

if (dateSet.size === 0) return [];

const sortedUnique = Array.from(dateSet).sort();
const startDate = sortedUnique[0];
const endDate = sortedUnique[sortedUnique.length - 1];

// Generate continuous daily dates from start to end
const allDates: string[] = [];
const current = new Date(startDate + 'T00:00:00');
const end = new Date(endDate + 'T00:00:00');
while (current <= end) {
  allDates.push(current.toISOString().split('T')[0]);
  current.setDate(current.getDate() + 1);
}
```

This guarantees snapshots emit on every day between the first event and the last, using cost-basis fallback when NAV is unavailable.

### 2. `src/components/dashboard/PortfolioChart.tsx` — Add empty-data guard

Insert after `chartData` construction (after line 29), before the loading check:

```tsx
if (!isLoading && chartData.length < 2) {
  return (
    <Card>
      <CardHeader className="pb-2">
        {/* same header with value + range buttons */}
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[280px] flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Add transactions or wait for NAV updates to display chart
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3. `src/components/dashboard/PortfolioChart.tsx` — ResponsiveContainer fix

Add `minWidth={1} minHeight={1}` to the existing `ResponsiveContainer` (line 73).

### 4. `src/components/dashboard/PortfolioTWRChart.tsx` — ResponsiveContainer fix

Add `minWidth={1} minHeight={1}` to the existing `ResponsiveContainer` (line 64).

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/use-portfolio-time-series.ts` | Fill continuous daily dates instead of sparse union |
| `src/components/dashboard/PortfolioChart.tsx` | Empty-data guard + ResponsiveContainer fix |
| `src/components/dashboard/PortfolioTWRChart.tsx` | ResponsiveContainer fix |

## Not Changed
- Database schema, Dashboard.tsx, TWR calculation, portfolio value calculation — all untouched.

