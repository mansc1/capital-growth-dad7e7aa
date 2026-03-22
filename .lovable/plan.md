

## Polish Dashboard, Fund Detail, and Portfolio Metadata UX

### Summary
Four areas of polish across 3 files. No schema, analytics, or layout changes.

---

### 1. Time Range Selector — Already correct, no changes needed

The range selector already uses `["1M", "3M", "6M", "YTD", "1Y", "SINCE_START"]` with `rangeLabel()` producing "Since Start". It's positioned top-right of the Portfolio Value chart header. TWR and Fund Performance charts share the same range via Dashboard state. No changes required.

---

### 2. Asset Class Fallback Display

**Files:** `src/pages/FundDetail.tsx`, `src/pages/Holdings.tsx`, `src/components/dashboard/HoldingsSummaryTable.tsx`

Currently `fund.asset_class` is rendered directly. When `null`, it shows blank/empty badge.

**Fix:** Show `fund.asset_class ?? "—"` in all three locations:

- **FundDetail.tsx line 90**: `<Badge variant="secondary">{fund.asset_class ?? "—"}</Badge>`
- **Holdings.tsx line 76**: `{h.fund.asset_class ?? "—"}`
- **HoldingsSummaryTable.tsx line 53**: `{h.fund.asset_class ?? "—"}`

---

### 3. Fund Detail Metadata Polish

**File:** `src/pages/FundDetail.tsx`

**3a. Dynamic risk badge with colored dot** (lines 91):

Add helper functions and replace the static risk badge:
```ts
function normalizeRiskLevel(risk: number | null | undefined): number | null {
  if (risk == null || risk < 1 || risk > 8) return null;
  return risk;
}
function getRiskDotClass(risk: number | null): string {
  if (risk === null) return "bg-gray-400";
  if (risk <= 3) return "bg-green-500";
  if (risk <= 5) return "bg-yellow-500";
  if (risk <= 7) return "bg-orange-500";
  return "bg-red-500";
}
```

Replace line 91 with:
```tsx
<Badge variant="outline" className="flex items-center gap-1.5">
  <span className={`inline-block h-2 w-2 rounded-full ${getRiskDotClass(normalizeRiskLevel(fund.risk_level))}`} />
  {fund.risk_level != null && fund.risk_level >= 1 && fund.risk_level <= 8
    ? `Risk ${fund.risk_level}/8`
    : "Risk —"}
</Badge>
```

**3b. Latest NAV display in NAV History header** (line 142):

Show latest NAV value and date from the last `navHistory` entry:
```tsx
<div className="flex items-center justify-between">
  <CardTitle className="text-sm font-medium">NAV History</CardTitle>
  {navHistory && navHistory.length > 0 && (
    <p className="text-xs text-muted-foreground">
      Latest: {Number(navHistory[navHistory.length - 1].nav_per_unit).toFixed(4)}
      {" "}({formatDate(navHistory[navHistory.length - 1].nav_date)})
    </p>
  )}
</div>
```

---

### 4. Empty/Pending State Consistency

**4a. FundDetail transaction table** — NAV column (line 222):

Currently shows `formatNumber(0)` for pending NAV. Fix:
```tsx
{Number(tx.nav_at_trade) === 0
  ? <span className="italic text-muted-foreground text-xs">Updating...</span>
  : formatNumber(Number(tx.nav_at_trade))}
```

**4b. FundDetail transaction table** — Units column (line 220):

Show "Pending" instead of `0.0000` when units are 0 (pending NAV buy):
```tsx
{Number(tx.units) === 0
  ? <span className="italic text-muted-foreground text-xs">Pending</span>
  : formatNumber(Number(tx.units))}
```

---

### Files changed

| File | Changes |
|------|---------|
| `src/pages/FundDetail.tsx` | Risk badge with colored dot, asset class fallback, latest NAV in header, pending NAV/units display in tx table |
| `src/pages/Holdings.tsx` | Asset class fallback `?? "—"` |
| `src/components/dashboard/HoldingsSummaryTable.tsx` | Asset class fallback `?? "—"` |

### What stays unchanged
- Dashboard layout order
- All analytics/returns logic
- All hooks
- Schema
- Chart rendering logic
- Transaction drawer (already has correct pending states)
- Transactions page (already handles NAV=0)

