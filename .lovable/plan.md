## Upgrade On Track Score to Feel Alive (Delta + Trend + Target)

### Summary

Replace the static "Improving/Stable/Declining" trend label with a concrete weekly delta number, add a target context line, and improve MiniScoreHistory with a connected dot sparkline instead of plain bars.

### Changes

**1. `src/components/retirement/OnTrackScoreCard.tsx**` — Replace trend label with weekly delta + add target context

- Import `getWeeklyDelta`, `loadScoreHistory` internally (or accept delta as prop)
- Replace the trend icon+label area with weekly delta display:
  - `+3 this week` (green), `−2 this week` (red), `No change this week` (muted)
  - Still use TrendingUp/Down/Minus icons based on delta sign
- Add a target context line below recommendation:
  - Compute next band threshold from score (e.g. score 64 → "16 points to reach Strong")
  - If already Excellent: "You're at the top — keep it up"
  - Helper function `getTargetContext(score, band): string`

**2. `src/components/retirement/MiniScoreHistory.tsx**` — Replace bars with dot sparkline

- Full state (>=7 points): Replace bar chart with an SVG sparkline
  - Polyline connecting score values
  - Small circle on the last point (highlighted)
  - Subtle fill below the line (primary/10)
  - Fixed height (32px), width fills container
  - Y-axis auto-scales to min/max of data with padding
- Early state (<7 points): Keep "Getting started" label, render dots only (small circles, no line) left-aligned
- Weekly delta display stays in the header (already there)

**3. `src/pages/Home.tsx**` — Replace trend label with weekly delta in hero

- Compute `weeklyDelta` from `getWeeklyDelta(scoreHistory)`
- Replace the `trendLabels[scoreData.trend]` display with delta text (same format as OnTrackScoreCard)
- Add target context line below recommendation

### Target context logic (in OnTrackScoreCard or a small helper)

```text
score >= 90 → "You're at the top — keep it up"
score >= 75 → "{90 - score} points to Excellent"
score >= 60 → "{75 - score} points to Strong"
score >= 45 → "{60 - score} points to On Track"
else        → "{45 - score} points to Needs Attention"
Getting Started band → "Building your score history"
```

### What stays unchanged

- Score computation logic, storage, simulation
- MiniScoreHistory weekly delta calculation (reused)
- All other pages and components

Additional guard rails:

- Prefer passing `history` or `weeklyDelta` into OnTrackScoreCard as props instead of loading score history inside the card itself. Keep data flow page-owned and explicit.

- Ensure weekly delta always uses the same score-history context as the displayed score (especially active-plan history on Home and My Plan).

- In MiniScoreHistory sparkline, guard against min === max so a flat score history still renders correctly with sensible padding.

- Keep visual hierarchy clear: score first, weekly delta second, recommendation third, target context fourth. Target context should be more muted than recommendation.

- If band is "Getting Started", always override target context with "Building your score history" instead of calculating points to the next band.