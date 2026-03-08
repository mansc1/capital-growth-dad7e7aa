

# Fix Portfolio TWR: Cash-Flow Adjusted Calculation

## 3 File Changes (no DB changes)

### 1. `src/types/portfolio.ts` (line 59)
Add after `created_at: string;`:
```typescript
/** Net external cash flow on this snapshot date only (buys/switch_in/reinvest minus sells/switch_out). Not carried forward. */
net_flow?: number;
```

### 2. `src/hooks/use-portfolio-time-series.ts` (lines 65–149)
Inside the date-walking loop, add `let dayNetFlow = 0;` reset fresh at the top of each date iteration. Track flows during transaction processing:
- `buy` / `switch_in`: `dayNetFlow += tx.amount`
- `sell` / `switch_out`: `dayNetFlow -= tx.amount`
- `dividend` (reinvest): `dayNetFlow += tx.amount` (consistent with cost-basis convention)
- `dividend` (cash): no flow

Emit `net_flow: dayNetFlow` explicitly on every snapshot (including dates with no transactions where it will be `0`).

### 3. `src/analytics/returns.ts` — Three functions updated with identical `prevValue > 0` guard

**`computePortfolioTWR`** (lines 34–42):
```typescript
const flow = filtered[i].net_flow ?? 0;
const dailyReturn = prevValue > 0 ? (currValue - flow - prevValue) / prevValue : 0;
```

**`computeDailyReturns`** (lines 138–144):
```typescript
const prevValue = Number(sorted[i - 1].total_value);
const currValue = Number(sorted[i].total_value);
if (prevValue > 0) {
  const flow = sorted[i].net_flow ?? 0;
  map.set(sorted[i].snapshot_date, ((currValue - flow - prevValue) / prevValue) * 100);
}
```

**`computePortfolioTWRSeries`** (lines 177–189):
```typescript
const flow = sorted[i].net_flow ?? 0;
const dailyReturn = prevValue > 0 ? (currValue - flow - prevValue) / prevValue : 0;
```

All three use identical `prevValue > 0` guard so aggregate TWR and series cannot drift.

### No changes to:
- Dashboard.tsx, PortfolioTWRChart.tsx, StatCards.tsx — consume snapshots which will now include `net_flow`
- Portfolio Value chart — uses `total_value` directly
- Fund-level return functions — NAV-based, unaffected

### Expected Result
TWR drops from ~+409% to realistic range (~1-5%) based on actual NAV movement.

