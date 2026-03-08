

# Add Transaction Markers to Portfolio Value Chart

## Implementation Plan (3 files)

### 1. `src/types/portfolio.ts`
Add after `net_flow?: number;` (line 60):
```typescript
has_transaction?: boolean;
tx_count?: number;
```

### 2. `src/hooks/use-portfolio-time-series.ts`
In the `result.push` block, after `net_flow: dayNetFlow,` (line 167), add:
```typescript
has_transaction: !!dayTxs,
tx_count: dayTxs ? dayTxs.length : 0,
```

### 3. `src/components/dashboard/PortfolioChart.tsx`

**chartData** (lines 25-29) — explicitly populate for every point:
```typescript
const chartData = snapshots.map((s) => ({
  date: s.snapshot_date,
  value: Number(s.total_value),
  dailyReturn: dailyReturns.get(s.snapshot_date) ?? null,
  has_transaction: s.has_transaction ?? false,
  tx_count: s.tx_count ?? 0,
}));
```

**Tooltip** — after dailyReturn block (~line 123), add:
```tsx
{d.tx_count > 0 && (
  <p className="text-xs text-muted-foreground">
    Transactions: {d.tx_count}
  </p>
)}
```

**Area component** (lines 129-135) — replace with custom dot + activeDot:
```tsx
<Area
  type="monotone"
  dataKey="value"
  stroke="hsl(var(--chart-1))"
  strokeWidth={2}
  fill="url(#portfolioGradient)"
  dot={(props: any) => {
    const { cx, cy, payload } = props;
    if (!payload.has_transaction) return <g />;
    return (
      <circle cx={cx} cy={cy} r={3}
        fill="hsl(var(--chart-1))"
        stroke="hsl(var(--background))"
        strokeWidth={1.5} />
    );
  }}
  activeDot={{ r: 4, strokeWidth: 2 }}
/>
```

### Not changed
TWR chart, portfolio value calculation, range controls, empty states, database schema.

