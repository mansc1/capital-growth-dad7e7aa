

# Fix Portfolio Valuation: Cost-Basis Fallback for Missing NAV

## Problem

Line 64 in `src/lib/holdings.ts`: `const latestNav = latestNavs[fund.id]?.nav_per_unit ?? 0;` — missing NAV defaults to 0, producing `market_value = 0` and `return = -100%`. The same issue exists in the server-side `rebuild-portfolio-snapshots.ts` (line 96-97: funds with no NAV are skipped entirely via `if (!nav) continue`, excluding their cost from totals).

## Changes

### 1. Add `valuation_status` to `Holding` type (`src/types/portfolio.ts`)

Add a new field to the `Holding` interface:

```typescript
valuation_status: 'ready' | 'waiting_for_nav' | 'nav_unavailable';
```

### 2. Fix core valuation logic (`src/lib/holdings.ts`)

Change `computeHoldings` signature to accept an optional `activeBackfillFundIds` set (fund IDs with pending/processing backfill jobs) so it can distinguish `waiting_for_nav` from `nav_unavailable`.

For each fund with `total_units > 0`:
- If `latestNavs[fund.id]` exists: use real NAV, status = `'ready'`
- If missing and fund is in `activeBackfillFundIds`: `market_value = total_cost`, `gain_loss = 0`, `return_pct = 0`, status = `'waiting_for_nav'`
- If missing and no active backfill: same cost-basis fallback, status = `'nav_unavailable'`

The `totalMarketValue` accumulator uses the effective market value (cost basis for missing NAV funds) so allocation percentages remain correct.

### 3. Update `useHoldings` hook (`src/hooks/use-holdings.ts`)

Fetch active backfill fund IDs alongside existing queries:

```typescript
supabase.from('nav_backfill_queue')
  .select('fund_id')
  .in('status', ['pending', 'processing'])
```

Pass the resulting `Set<string>` to `computeHoldings`.

### 4. Update Holdings UI (`src/pages/Holdings.tsx`)

For the Latest NAV column:
- `ready`: show `formatNumber(h.latest_nav)`
- `waiting_for_nav`: show `"Updating..."` in amber text
- `nav_unavailable`: show `"—"`

For Market Value when not `ready`: show value with a small "(cost basis)" label.

For Return when not `ready`: show `"—"` instead of `formatPercent(0)`.

### 5. Update Dashboard Holdings Summary (`src/components/dashboard/HoldingsSummaryTable.tsx`)

Same conditional rendering for gain/loss and return columns based on `valuation_status`.

### 6. Fix server-side snapshot rebuild (`supabase/functions/_shared/portfolio/rebuild-portfolio-snapshots.ts`)

Currently skips funds with no NAV (`if (!nav) continue`). Change to:
- If no NAV row exists, use cost-basis fallback: `totalValue += holding.totalCost`, `totalCost += holding.totalCost`
- This prevents the snapshot from excluding funds that are waiting for NAV data.

## Files Summary

| File | Change |
|------|--------|
| `src/types/portfolio.ts` | Add `valuation_status` to `Holding` |
| `src/lib/holdings.ts` | Cost-basis fallback + status assignment |
| `src/hooks/use-holdings.ts` | Fetch active backfill fund IDs, pass to compute |
| `src/pages/Holdings.tsx` | Conditional UI per valuation status |
| `src/components/dashboard/HoldingsSummaryTable.tsx` | Conditional UI per valuation status |
| `supabase/functions/_shared/portfolio/rebuild-portfolio-snapshots.ts` | Cost-basis fallback for missing NAV |

Note: `usePortfolioTimeSeries` already implements cost-basis fallback correctly (lines 127-129) — no changes needed there. Dashboard `StatCards` derives from holdings data so it will automatically reflect the fix.

