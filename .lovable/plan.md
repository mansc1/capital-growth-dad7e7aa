## Add Mini Score History to On Track Score

### Summary

Create a localStorage-based score history (max 28 days, 1 point/day), a compact bar chart component, and integrate into `OnTrackScoreCard`.

### File 1: `src/lib/on-track-score-history.ts` — Storage + helpers

- Types: `ScoreHistoryPoint = { date: string; score: number }`, `ScoreHistory = ScoreHistoryPoint[]`
- `loadScoreHistory()`: parse from localStorage key `"on_track_score_history"`, try/catch → return `[]` on error
- `saveScoreHistory(history)`: JSON.stringify to localStorage, try/catch
- `addScorePoint(score)`: load history, find today's entry (overwrite or push), trim to 28 entries, save
- `getWeeklyDelta(history)`: compare latest score vs score ~7 days ago, return `number | null`

### File 2: `src/components/retirement/MiniScoreHistory.tsx` — Compact bar chart

- Props: `{ history: ScoreHistory }`
- Render up to 28 vertical div bars, height proportional to score (0-100)
- Last 7 days bars slightly brighter/highlighted
- Show "Last 4 weeks" label
- Show weekly delta: "+3 this week" / "−2 this week" using `getWeeklyDelta`
- Pure CSS divs, no recharts dependency
- If history is empty or < 2 points, show nothing

### File 3: `src/components/retirement/OnTrackScoreCard.tsx` — Add history prop

- Add optional `history?: ScoreHistory` prop
- Import and render `MiniScoreHistory` below subtitle when history has >= 2 points

### File 4: `src/pages/RetirementPlanner.tsx` — Record + pass history

- Import `addScorePoint`, `loadScoreHistory`
- After `scoreData` is computed, add `useEffect` to call `addScorePoint(scoreData.score)` when score changes
- Load history with `useMemo(() => loadScoreHistory(), [scoreData?.score])`
- Pass `history` to `OnTrackScoreCard`

### File 5: `src/pages/MyPlan.tsx` — Record + pass history

- Same pattern: `useEffect` to record score, load history, pass to `OnTrackScoreCard`

### What stays unchanged

- Scoring logic, simulation, all formulas
- Layout structure, other pages
- No backend/database changes

Additional guard rails:

- Do not mix draft-plan score history with active-plan score history. Prefer storing history for the active plan only (My Plan) so the trend reflects the confirmed plan, not temporary draft edits.

- In getWeeklyDelta(history), compare the latest point with the closest available point from about 7 days earlier, not simply the item 7 positions back.

- Ensure mini bars have a minimum visible height so low scores still render clearly.

- If history has fewer than 2 points, render nothing at all (including no label and no weekly delta text).

- Always sort history by date ascending before rendering or computing delta.