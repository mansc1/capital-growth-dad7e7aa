

## Add Score Driver System (Consistency / Progress / Momentum)

### Summary

Create driver logic utilities, a compact UI component, and wire them into the Home page below MiniScoreHistory — explaining why the score is what it is.

### Changes

**1. `src/lib/on-track-drivers.ts`** — Driver logic

- Type: `ScoreDriver = { label, value, trend, impact }`
- `computeConsistencyDriver(monthlyContribs, plannedMonthly)`: ratio of actual vs planned contributions over recent months, clamped 0–100. Trend: ≥80 up/positive, 50–79 flat/neutral, <50 down/negative
- `computeProgressDriver(actual, projected)`: reuse the same ratio→score curve from `computeProgressScore` in `on-track-score.ts`. Same trend thresholds
- `computeMomentumDriver(ratioNow, ratio6mAgo)`: reuse `computeMomentumScore` output, map to trend. Missing data → neutral default (value 50, flat)
- `computeScoreDrivers(...)`: orchestrates all three, returns `ScoreDriver[]`
- All functions return neutral defaults when data is missing

**2. `src/components/home/ScoreDrivers.tsx`** — UI component

- Props: `drivers: ScoreDriver[]`
- Title: "Why your score" — `text-xs uppercase tracking-widest text-muted-foreground`
- 3 rows, each `flex items-center justify-between`:
  - Left: label (`text-sm`)
  - Right: trend icon (TrendingUp/Down/Minus, 14px) + value (`text-sm font-semibold`), colored by impact
- Compact vertical stack with minimal spacing

**3. `src/pages/Home.tsx`** — Integration

- Import `computeScoreDrivers` and `ScoreDrivers`
- Inside the existing `scoreData` useMemo (or a new memo using same inputs), compute drivers using:
  - `monthlyContribs` and `plannedMonthly` (already computed for consistency score)
  - `actualValue` and `projectedValue` (already available)
  - `ratioNow` and `ratio6mAgo` (already computed for momentum)
- Store drivers alongside scoreData
- Render `<ScoreDrivers>` between MiniScoreHistory and recommendation text

### Rendering order (unchanged except insertion)
1. Score ring
2. Weekly delta
3. Mini score history
4. **Why your score** ← new
5. Recommendation
6. Target context

### What stays unchanged
- On Track Score formula, weights, smoothing
- Score history storage and display
- All other pages
- Snapshot strip, action card, quick actions

