

# Enhanced NAV Autofill with Fallback — Implementation Plan

## Summary
Replace the exact-match-only `useNavLookup` with a new `useNavForTradeDate` hook that falls back to the most recent NAV on or before the trade date. Add manual override tracking, edit-mode guards, and contextual helper text in the Transaction Drawer.

---

## Changes (3 files)

### 1. NEW: `src/hooks/use-nav-for-trade-date.ts`

Single query against `nav_history`:
- `eq('fund_id', fundId)` + `lte('nav_date', tradeDate)` + `order('nav_date', desc)` + `limit(1)` + `maybeSingle()`
- Enabled only when both `fundId` and `tradeDate` are truthy
- Returns `{ nav: number | null, navDateUsed: string | null, isExactMatch: boolean, isLoading: boolean }`
- `isExactMatch = navDateUsed === tradeDate`
- `isLoading` only true when both inputs are present and query is still loading

### 2. EDIT: `src/components/transactions/TransactionDrawer.tsx`

**Imports:** Replace `useNavLookup` from `use-nav-history` with `useNavForTradeDate` from `use-nav-for-trade-date`. Remove `Alert`, `AlertDescription`, `AlertTriangle` imports.

**New state/refs:**
- `navManuallyEdited: boolean` state (default `false`)
- `prevFundId` and `prevDate` refs to track actual value changes (not just rerenders)
- `isEditInitialLoad` ref — set `true` when edit form populates, set `false` on first fund/date change

**Reset logic (dedicated effect):**
- Compare `watchFundId`/`watchDate` against `prevFundId`/`prevDate` refs
- Only reset `navManuallyEdited = false` when values actually change
- Update refs after comparison
- Also set `isEditInitialLoad = false` when values change during edit

**Hook call:** `const { nav, navDateUsed, isExactMatch, isLoading: navLoading } = useNavForTradeDate(watchFundId, watchDate);`

**Autofill effect** (replaces old navLookup effect):
- Guard: skip if `navManuallyEdited`, `isEditInitialLoad`, or `nav === null`
- Before calling `setValue`, check if `form.getValues("nav_at_trade")` already equals `nav` to avoid unnecessary updates
- Remove old `navNotFound` state entirely

**Edit mode setup** (in the existing editTransaction effect):
- Set `isEditInitialLoad.current = true` when populating edit form
- Set `isEditInitialLoad.current = false` and `navManuallyEdited = false` in the else (new transaction) branch

**NAV input field:**
- Add `navManuallyEdited = true` to the onChange handler alongside `field.onChange`
- Remove old `(auto-filled)` label text from FormLabel

**Replace the yellow Alert block** (lines 297-304) and old label text with helper text below the NAV field:

```
{navLoading && watchFundId && watchDate && (
  <p className="text-xs text-muted-foreground">Looking up NAV…</p>
)}
{!navLoading && nav !== null && isExactMatch && !navManuallyEdited && (
  <p className="text-xs text-muted-foreground">NAV auto-filled from {navDateUsed}</p>
)}
{!navLoading && nav !== null && !isExactMatch && !navManuallyEdited && (
  <p className="text-xs text-amber-600 dark:text-amber-400">
    Using latest available NAV from {navDateUsed} (trade date: {watchDate})
  </p>
)}
{!navLoading && nav === null && watchFundId && watchDate && (
  <p className="text-xs text-muted-foreground">
    {isBuyType || isSellType
      ? "No NAV found for this fund. Enter NAV manually or sync NAV data first."
      : "No NAV found for this date. Enter NAV manually."}
  </p>
)}
```

The fallback text uses `text-amber-600` to be visually distinct from the exact-match text, making it clear an earlier date's NAV is being used.

### 3. EDIT: `src/hooks/use-nav-history.ts`

Remove the `useNavLookup` function (lines 21-37). Keep `useNavHistory` and `useLatestNavs` unchanged.

---

## What stays unchanged
- All transaction CRUD logic, units/amount auto-compute, sell validation
- SEC fund search, fund selection, dividend handling
- NAV sync, holdings, dashboard, portfolio snapshots
- No database or schema changes needed

