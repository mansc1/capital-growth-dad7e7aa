

## Refine Home Portfolio Consistency Fix (Edge Cases + Safe Fallback)

### Summary

Add safety guards to the score computation in `Home.tsx` and increase actual bar visibility in `RetirementChart.tsx`.

### Changes

**1. `src/pages/Home.tsx`** — Harden score computation

- **Guard simulation data** (line 129): Add `!result?.rows?.length` to the early return check
- **MAX_AGE_DIFF threshold** (lines 134-137): After finding the closest `projectedRow`, check `Math.abs(projectedRow.age - currentAge) > 2` — if so, treat as null and skip score computation
- **Consistent age calc**: Use `Math.floor` for currentAge: `Math.floor((Date.now() - new Date(input.birthYear, 0, 1).getTime()) / (365.25 * 86400000))` — but this is overkill; the current `new Date().getFullYear() - input.birthYear` is used everywhere consistently, so keep it but ensure `actualByAge` uses the same method (it already does at line 115)
- **Score fallback order** (line 132): Already uses `latestSnap.total_value` directly. No change needed — the actual value source is already the latest snap.

Concrete code change in `scoreData` useMemo:
```
if (!portfolioTimeSeries?.length || !result?.rows?.length) return null;
...
let projectedRow = result.rows.find((r) => r.age === currentAge)
  ?? result.rows.reduce((closest, r) =>
    Math.abs(r.age - currentAge) < Math.abs(closest.age - currentAge) ? r : closest
  );
const MAX_AGE_DIFF = 2;
if (Math.abs(projectedRow.age - currentAge) > MAX_AGE_DIFF) return null;
```

- **Remove unused `comparisonMode` state** (line 107): It's passed to `RetirementChart` but `hideComparisonToggle` is true, so comparison is never used. Keep the state for the prop requirement but this is harmless.

**2. `src/components/retirement/RetirementChart.tsx`** — Increase actual bar visibility

- Line 49: Change `ACTUAL_BAR_COLOR` from `hsla(221, 83%, 53%, 0.25)` to `hsla(221, 83%, 53%, 0.4)`

### What stays unchanged
- Score computation formulas, simulation engine
- All other pages, hooks, storage helpers
- Home page layout and role

