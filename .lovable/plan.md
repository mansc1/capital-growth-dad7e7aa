

## Fix Mini Score History Not Rendering

### Root Cause
All wiring is correct — history is loaded, passed to `OnTrackScoreCard`, and `MiniScoreHistory` is imported and rendered. The issue is the `history.length < 2` guard in `MiniScoreHistory.tsx` prevents rendering when there's only 1 data point.

### Changes

**1. `src/components/retirement/MiniScoreHistory.tsx`** — Relax guard to >= 1
- Change `if (history.length < 2) return null` → `if (history.length < 1) return null`
- Hide weekly delta when fewer than 2 points (already handled by `getWeeklyDelta`)

**2. `src/components/retirement/OnTrackScoreCard.tsx`** — Relax render condition
- Change `history.length >= 2` → `history.length >= 1`

**3. `src/pages/RetirementPlanner.tsx`** — Add debug log
- Add `console.log("Score history:", scoreHistory)` after loading history

**4. `src/pages/MyPlan.tsx`** — Add debug log
- Same debug log after loading history

### What stays unchanged
- Score logic, storage logic, all other components

