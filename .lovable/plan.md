

## Add Transaction Markers to Fund Detail NAV History Chart

**File:** `src/pages/FundDetail.tsx`

### Change 1 — Enrich chartData with transaction info (line 64-67)

Build a Set of transaction dates, then annotate each NAV point:

```ts
const txDates = useMemo(() => {
  const map = new Map<string, number>();
  for (const tx of transactions ?? []) {
    map.set(tx.trade_date, (map.get(tx.trade_date) ?? 0) + 1);
  }
  return map;
}, [transactions]);

const chartData = (navHistory ?? []).map((n) => ({
  date: n.nav_date,
  nav: Number(n.nav_per_unit),
  has_transaction: txDates.has(n.nav_date),
  tx_count: txDates.get(n.nav_date) ?? 0,
}));
```

### Change 2 — Update tooltip to show tx count (lines 191-201)

Match Portfolio Value tooltip style, adding transaction count:

```tsx
<RechartsTooltip
  content={({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
        <p className="text-xs text-muted-foreground">{format(parseISO(d.date), "d MMM yyyy")}</p>
        <p className="text-sm font-semibold">{Number(d.nav).toFixed(4)}</p>
        {d.tx_count > 0 && (
          <p className="text-xs text-muted-foreground">
            Transactions: {d.tx_count}
          </p>
        )}
      </div>
    );
  }}
/>
```

### Change 3 — Add dot renderer + activeDot to Area (line 203)

Replace the plain `<Area>` with transaction markers matching Portfolio Value:

```tsx
<Area
  type="monotone"
  dataKey="nav"
  stroke="hsl(var(--chart-2))"
  strokeWidth={2}
  fill="url(#navGrad)"
  dot={(props: any) => {
    const { cx, cy, payload } = props;
    if (!payload.has_transaction) return <g />;
    return (
      <circle
        cx={cx} cy={cy} r={3}
        fill="hsl(var(--chart-2))"
        stroke="hsl(var(--background))"
        strokeWidth={1.5}
      />
    );
  }}
  activeDot={{ r: 4, strokeWidth: 2 }}
/>
```

Uses `--chart-2` (the existing NAV chart color) instead of `--chart-1` (portfolio color). Same marker size, stroke, and hover behavior.

