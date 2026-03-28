## Add Getting Started Mode to On Track Score

### Summary

Soften scoring for new users (< 3 months) by adding `monthsSinceStart` parameter, adjusting weights/floors, introducing a "Getting Started" band, and updating the UI card.

### File 1: `src/lib/on-track-score.ts`

**Update `OnTrackScoreInput` interface** — add `monthsSinceStart?: number`

**Update `computeOnTrackScore**` — apply soften logic when `monthsSinceStart < 3`:

- Floor progress at 50, consistency at 60
- Shift weights to 40/40/20 (favor consistency over progress)
- Normal users (>= 3 months) unchanged

**Update `ScoreBand` type** — add `"Getting Started"` to the union

**Update `getScoreBand**` — add `monthsSinceStart` parameter; if < 3, return `"Getting Started"`

**Update `getScoreRecommendation**` — add `monthsSinceStart` parameter; if < 3, return `"You're getting started. Stay consistent to build your momentum."`

### File 2: `src/components/retirement/OnTrackScoreCard.tsx`

**Add "Getting Started" to `bandColors**` — neutral blue/slate color (e.g. `bg-blue-500/15 text-blue-700 border-blue-500/30`)

### File 3: `src/pages/RetirementPlanner.tsx`

**Compute `monthsSinceStart**` from `portfolioTimeSeries[0].snapshot_date`:

```ts
const firstDate = portfolioTimeSeries[0].snapshot_date;
const monthsSinceStart = Math.floor(
  (Date.now() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
);
```

**Pass to scoring functions:**

```ts
const score = computeOnTrackScore({ progress, consistency, momentum, previousScore, monthsSinceStart });
const band = getScoreBand(score, monthsSinceStart);
const recommendation = getScoreRecommendation(score, monthsSinceStart);
```

### What stays unchanged

- All scoring formulas for users with >= 3 months
- Simulation logic, retirement inputs, other components
- Dashboard, Holdings, Transactions  


Additional Improvements for Getting Started Mode (Robustness Fixes)

These are small but important guard-rail improvements to ensure stability and correctness.

------------------------------------------------

1) Safe handling when portfolioTimeSeries is empty

In RetirementPlanner.tsx:

Current logic assumes portfolioTimeSeries[0] exists.

Update to safely handle empty or undefined arrays:

const firstDate = portfolioTimeSeries?.[0]?.snapshot_date ?? null;

const monthsSinceStart = firstDate

  ? Math.floor(

      ([Date.now](http://Date.now)() - new Date(firstDate).getTime()) /

      (1000  *60*  60  *24*  30.44)

    )

  : 0;

This prevents runtime errors when no portfolio data exists.

------------------------------------------------

2) Use date-fns differenceInMonths (preferred)

If date-fns is already available in the project, replace manual calculation with:

import { differenceInMonths } from "date-fns";

const monthsSinceStart = firstDate

  ? differenceInMonths(new Date(), new Date(firstDate))

  : 0;

This improves readability and avoids approximation issues.

If date-fns is not available, keep the existing calculation.

------------------------------------------------

3) Ensure "Getting Started" is fully supported in types and UI

Update ScoreBand type everywhere:

type ScoreBand =

  | "Excellent"

  | "Strong"

  | "On Track"

  | "Needs Attention"

  | "Off Pace"

  | "Getting Started";

Ensure all components that consume ScoreBand (especially OnTrackScoreCard) support:

- "Getting Started" in bandColors

- correct styling (neutral tone, not red/orange)

- no fallback to default styling

Also verify:

- no switch/case or mapping misses "Getting Started"

- no TypeScript exhaustiveness errors

------------------------------------------------

Expected Result

- No crash when portfolioTimeSeries is empty

- More reliable month calculation

- "Getting Started" behaves consistently across logic and UI