## Add "My Plan" (Active Plan Fact Sheet) Page

### Summary

Create a new read-only page at `/my-plan` that displays the user's confirmed active plan as a fact sheet. Reuse existing simulation engine and components, rendering them in read-only mode.

### File 1: `src/pages/MyPlan.tsx` — New Page

**Empty state** (no active plan): Card with "No active plan yet" message + "Go to Planner" button linking to `/retirement-planner`.

**Active plan state:**

- Header: "My Retirement Plan" title, "Active Plan" badge (green), "Last updated: {date}" subtitle, "Edit in Planner" link button
- Run `runSimulation(activePlan.input)` and compute On Track Score using the same logic as RetirementPlanner
- Render sections in order:
  1. **OnTrackScoreCard** — reuse existing component, computed from active plan input (not draft)
  2. **RetirementChart** — reuse existing, no comparison toggle (pass `comparisonMode={false}`, `onToggleComparison` as no-op)
  3. **SummaryMetrics** — reuse existing
  4. **Assumptions** — render as static text (Birth Year, Retirement Age, Target Age) in a Card, no inputs
  5. **Savings Plan** — render ranges as a read-only list (From/To/Monthly as text rows)
  6. **Return Assumption** — show mode + value(s) as static text
  7. **Spending Strategy** — show mode + values as static text
  8. **YearlyDetailsTable** — reuse existing component as-is (already read-only)

For sections 4-7, create inline read-only renders rather than adding `readOnly` props to existing components (simpler, no risk of breaking Planner).

### File 2: `src/App.tsx` — Add Route

Add: `<Route path="/my-plan" element={<MyPlan />} />`

### File 3: `src/components/AppSidebar.tsx` — Add Menu Item

Add "My Plan" entry with `FileText` icon from lucide-react, placed before "Retirement Planner" in the nav items array.

### What stays unchanged

- RetirementPlanner page — no changes at all
- All simulation, scoring, storage logic
- All existing components (no `readOnly` props added)
- Dashboard, Holdings, Transactions, Settings

### Technical notes

- Active plan loaded via existing `loadActivePlan()` from `retirement-plan-storage.ts`
- On Track Score computed using same `usePortfolioTimeSeries` + scoring functions as Planner
- Chart receives `onToggleComparison` as no-op since comparison is disabled on this page
- Read-only sections are simple Card + text layouts, not reusing editable components

Additional guard rails:

- Normalize activePlan.input before running simulation in case older saved plans are missing newer fields.

- Ensure On Track Score on /my-plan uses active plan data only, never draft state.

- Add a small helper text near the header: "This page shows your confirmed plan. To make changes, edit your draft in Retirement Planner."

- Verify YearlyDetailsTable receives all required props when rendered outside RetirementPlanner.