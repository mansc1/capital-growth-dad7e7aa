

## Fix Home Page Portfolio Data Inconsistency

### Problem Analysis

1. **Score shows empty state despite portfolio existing**: In `Home.tsx` line 118-120, `scoreData` becomes `null` when `currentAge` doesn't match any simulation row (e.g., simulation starts at age 35 but user is 34). Portfolio card (line 307) independently checks `portfolioValue !== null`, so they diverge.

2. **No Retirement Balance Projection chart on Home**: Home page currently has no chart at all — only plan summary cards and a portfolio mini card. The user expects actual overlay bars in a projection chart on Home.

### Changes

**1. `src/pages/Home.tsx`** — Fix score computation fallback + add projection chart

- **Score fix**: When `projectedRow` for exact `currentAge` is missing, find the closest age row in simulation results. If still no match, use `latestPortfolioValue` as `actualValue` and estimate projected from nearest row. This prevents the empty-state message when portfolio data clearly exists.

- **Add RetirementChart**: Import `RetirementChart` and render it below the plan summary cards. Build `actualByAge` map from `portfolioTimeSeries` (same pattern as `MyPlan.tsx` lines 90-101). Pass `hideComparisonToggle={true}` to keep Home simple.

- **Actual value fallback for score**: 
  ```text
  const projectedRow = result.rows.find(r => r.age === currentAge)
    ?? result.rows.reduce((closest, r) => 
      Math.abs(r.age - currentAge) < Math.abs(closest.age - currentAge) ? r : closest
    );
  ```

**2. `src/components/retirement/RetirementChart.tsx`** — No changes needed

The chart already supports `actualByAge` prop and renders bars when data exists. The `ACTUAL_BAR_COLOR` (`hsla(221, 83%, 53%, 0.25)`) is already defined. If bars appear too faint, increase opacity slightly to `0.35`.

### What stays unchanged
- Simulation logic, score computation formulas
- MyPlan, RetirementPlanner pages
- All hooks, storage helpers
- Home page role (score-first check-in, not a duplicate of My Plan)

