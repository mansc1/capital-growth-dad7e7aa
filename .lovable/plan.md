

## Refactor Holdings Table with NAV Sparklines

### Changes

**1. Create `src/components/holdings/NavSparkline.tsx`** — Tiny SVG sparkline component

- Pure SVG, no Recharts overhead
- Props: `data: number[]` (NAV values), fixed width 100px, height 32px
- Renders a single polyline with `stroke: hsl(var(--muted-foreground))`, `strokeWidth: 1.5`, rounded joins, no fill
- If `data.length < 2`, render `<span className="text-muted-foreground text-xs">—</span>`
- No axes, dots, tooltips, labels, or grid

```tsx
function NavSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const w = 100, h = 32, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) =>
    `${pad + (i / (data.length - 1)) * (w - 2 * pad)},${pad + (1 - (v - min) / range) * (h - 2 * pad)}`
  ).join(' ');
  return (
    <svg width={w} height={h} className="block">
      <polyline points={points} fill="none" stroke="hsl(var(--muted-foreground))"
        strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
```

**2. Create `src/hooks/use-holdings-sparklines.ts`** — Single query for all held funds, last 90 days

```ts
export function useHoldingsSparklines(fundIds: string[]) {
  const sortedIds = useMemo(() => [...fundIds].sort(), [fundIds]);
  return useQuery({
    queryKey: ['holdings_sparklines', sortedIds],
    enabled: sortedIds.length > 0,
    queryFn: async () => {
      const from = subDays(new Date(), 90).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('nav_history')
        .select('fund_id, nav_per_unit, nav_date')
        .in('fund_id', sortedIds)
        .gte('nav_date', from)
        .order('nav_date', { ascending: true })
        .limit(5000);
      if (error) throw error;
      // Group by fund_id → number[]
      const map: Record<string, number[]> = {};
      for (const r of data || []) {
        (map[r.fund_id] ??= []).push(Number(r.nav_per_unit));
      }
      return map;
    },
  });
}
```

One query total, filtered by fund IDs + date. Returns `Record<fund_id, number[]>`.

**3. Update `src/pages/Holdings.tsx`**

- Import `NavSparkline` and `useHoldingsSparklines`
- Derive `heldFundIds` from holdings with `useMemo`
- Call `useHoldingsSparklines(heldFundIds)`
- Remove line 64 (fund subtitle `<p>` with `fund_name`)
- Remove AMC `<TableHead>` (line 38) and `<TableCell>` (line 73)
- Add `Trend` column header after Fund
- Add sparkline cell: `<NavSparkline data={sparklines?.[h.fund.id] ?? []} />`

Final column order: Fund | Trend | Asset Class | Units | Avg Cost | Latest NAV | Market Value | Gain/Loss | Return | Alloc.

### What stays unchanged
- `use-holdings.ts` — no changes
- Holdings calculations, gain/loss, allocation logic
- Fund Detail page (still shows full name, AMC, full NAV chart)
- Dashboard charts, analytics, schema

