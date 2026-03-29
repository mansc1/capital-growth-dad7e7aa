

## Refactor Home Page to Final Score-First Design

### Summary

The current Home page is close to the target but needs: removal of the RetirementChart, replacement of "Balance at Retirement / Money Runs Out" cards with "Portfolio Value / Balance at Retirement" snapshot cards, addition of a "What to do next" action card, and reordering of sections.

### Changes — `src/pages/Home.tsx`

**1. Remove RetirementChart** (lines 302-313)
- Delete the `RetirementChart` import and its render block
- Remove `comparisonMode` state, `actualByAge` memo, and the `RetirementChart` import
- This eliminates the heavy projection chart from Home

**2. Replace plan summary cards** (lines 277-300)
- Change from "Balance at Retirement + Money Runs Out" to "Portfolio Value + Balance at Retirement"
- Card 1: Portfolio Value — move current portfolio mini card content here (latest `total_value`, return %)
- Card 2: Balance at Retirement — keep existing projected balance at retirement age
- Remove the standalone Portfolio Mini Card at the bottom (lines 337-363)
- Remove `runsOutAge`/`runsOutRow` computation (no longer displayed)

**3. Add "What to do next" action card** (new, between snapshot cards and quick actions)
- Single card with 1-2 suggestions derived from score band:
  - Off Pace / Needs Attention: "Consider increasing monthly savings" + "Review your retirement age target"
  - On Track: "Stay consistent with your current savings plan"
  - Strong / Excellent: "You're ahead of plan. Consider reviewing your risk allocation."
  - Getting Started: "Keep contributing regularly to build momentum."
- Simple helper function `getActionSuggestions(band): string[]`

**4. Reorder sections** (top to bottom):
1. Score Hero (unchanged)
2. Snapshot cards (Portfolio Value + Balance at Retirement)
3. What to do next
4. Quick Actions (unchanged)

**5. Cleanup unused imports**
- Remove `RetirementChart`, `useState` (no more comparisonMode), unused icons if any

### What stays unchanged
- Score computation logic, all fallbacks, MAX_AGE_DIFF guard
- Score history recording
- Empty state (HomeEmpty)
- Quick action buttons (already correct order)
- All other pages (My Plan, Retirement Planner, Dashboard)
- Sidebar navigation

