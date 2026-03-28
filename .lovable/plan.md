## Implement On Track Score + Recommendation System

### Summary

Create a scoring engine (`src/lib/on-track-score.ts`) and a display card (`src/components/retirement/OnTrackScoreCard.tsx`), then integrate into the Retirement Planner page above the projection chart.

### File 1: `src/lib/on-track-score.ts` — Scoring Engine

**Exports:**

- `computeProgressScore(actual, projected)` — non-linear interpolation mapping ratio → 0-100
- `computeConsistencyScore(contributions, plannedMonthly, monthsSinceStart)` — average monthly completion rate over min(12, monthsSinceStart)
- `computeMomentumScore(ratioNow, ratio6mAgo)` — bounded 50-85 soft modifier
- `computeOnTrackScore({ progress, consistency, momentum, previousScore? })` — weighted 55/25/20, smoothed with asymmetric alpha (0.18 up, 0.28 down)
- `getScoreBand(score)` — returns `"Excellent" | "Strong" | "On Track" | "Needs Attention" | "Off Pace"`
- `getScoreTrend(score, previousScore)` — returns `"improving" | "stable" | "declining"`
- `getScoreRecommendation(score)` — returns 1-2 line supportive guidance string

**Progress interpolation table:**

```
[0, 0], [0.5, 30], [0.7, 50], [0.85, 68], [1.0, 80], [1.1, 88], [1.25, 96], [1.35, 100]
```

**Smoothing:**

```ts
const alpha = raw > prev ? 0.18 : 0.28;
return prev + alpha * (raw - prev);
```

### File 2: `src/components/retirement/OnTrackScoreCard.tsx` — Display Card

A compact Card showing:

- Large score number (text-4xl font-bold)
- Band label as a colored badge (green for Excellent/Strong, yellow for On Track, orange for Needs Attention, red for Off Pace)
- Trend arrow (↑ Improving / → Stable / ↓ Declining) in muted text
- Recommendation text (text-sm text-muted-foreground)

Props: `{ score, band, trend, recommendation }`

If no actual portfolio data exists (score cannot be computed), show a muted "Connect portfolio data to see your On Track Score" message instead.

### File 3: `src/pages/RetirementPlanner.tsx` — Integration

**Compute score data** using existing `actualByAge`, `baseResult`, `portfolioTimeSeries`, and `input`:

```ts
const currentAge = new Date().getFullYear() - input.birthYear;
const actualValue = actualByAge?.get(currentAge) ?? null;
const projectedRow = baseResult?.rows.find(r => r.age === currentAge);
const projectedValue = projectedRow?.endBalance ?? null;

// For consistency: derive monthly contributions from portfolioTimeSeries net_flow
// For momentum: compute ratio 6 months ago from portfolioTimeSeries

const scoreData = useMemo(() => {
  if (!actualValue || !projectedValue || projectedValue <= 0) return null;
  // compute all sub-scores and final score
}, [actualValue, projectedValue, portfolioTimeSeries, input]);
```

**Render** the `OnTrackScoreCard` above the `RetirementChart` in both desktop (sticky sidebar) and mobile (MiniProjectionPanel area) layouts.

**Previous score** — store in `useRef` to enable smoothing across re-renders within the same session. No localStorage persistence needed for the score itself.

### What stays unchanged

- `retirement-simulation.ts` — no changes
- All simulation formulas, presets, storage
- Portfolio analytics, dashboard, holdings
- Navigation, routing, sidebar
- All existing retirement components

### Technical notes

- Consistency score uses `portfolioTimeSeries` `net_flow` field to approximate monthly contributions
- Momentum uses `actualByAge` values at current age vs ~6 months prior from time series
- Score only renders when both actual portfolio data AND valid simulation exist
- No backend persistence — score is computed on-the-fly from existing data

Additional guard rails:

1. Use the latest portfolio time series point as the current actual portfolio value for the score. Do not use actualByAge.get(currentAge) as the main current-value source, because that is an age-bucketed annual aggregate, not necessarily the latest actual value.

2. For consistency scoring, do not treat negative net_flow as missed contribution penalty. Use only positive contribution-like monthly flows (or derive monthly contributions from transactions if more reliable). At minimum, clamp monthly contribution input with Math.max(net_flow, 0).

3. Using useRef for previousScore is acceptable for v1, but smoothing should be understood as session-local only. After refresh, the score can initialize from raw score again.