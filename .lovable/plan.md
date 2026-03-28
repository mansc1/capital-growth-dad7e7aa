

## Polish UX: Clarify Draft vs Active Plan

### Summary

Add contextual labels and a subtitle prop to `OnTrackScoreCard`, hide the Compare toggle on My Plan, and improve the confirm toast with a "View My Plan" action.

### Changes

**1. `src/components/retirement/OnTrackScoreCard.tsx`** — Add optional `subtitle` prop

- Add `subtitle?: string` to `OnTrackScoreCardProps`
- Render below the recommendation text as a muted line when provided

**2. `src/pages/RetirementPlanner.tsx`** — Draft status + score subtitle + improved toast

- Add a status block between the header and the content grid:
  - No active plan: "You're creating your first plan"
  - Draft differs from active: "You're editing a draft plan" + helper: "Your active plan will not change until you click 'Set as My Plan'."
  - Draft matches active: "Using your active plan" (green tint)
- Pass `subtitle="Based on your draft plan"` to `OnTrackScoreCard`
- Update toast in `handleConfirmPlan` to include an action button "View My Plan" linking to `/my-plan`

**3. `src/pages/MyPlan.tsx`** — Score subtitle + helper text already present

- Pass `subtitle="Based on your active plan"` to `OnTrackScoreCard`
- Header helper text already exists (line 196-198) — no change needed

**4. `src/components/retirement/RetirementChart.tsx`** — Hide Compare toggle conditionally

- Add optional `hideComparisonToggle?: boolean` prop
- When true, hide the Switch + Label in the header
- In `MyPlan.tsx`, pass `hideComparisonToggle` to the chart

### What stays unchanged
- Simulation logic, scoring formulas, autosave
- All other pages and components
- PlanStatusCard (already handles draft vs active display)

