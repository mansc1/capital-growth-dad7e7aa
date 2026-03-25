## Import Retirement Journey Planner into Capital Growth

### Summary

Copy the full Retirement Journey Planner (9 components, 2 lib files) from the source project into Capital Growth, wrap it in the existing AppLayout, and replace the current placeholder page.

### Files to Create

**Lib/utility files (copy as-is):**

1. `src/lib/retirement-simulation.ts` -- All types, validation, and simulation logic
2. `src/lib/retirement-presets.ts` -- Return preset configurations (Conservative/Balanced/Growth)

**Component files (copy as-is, imports already use `@/` paths that resolve correctly):**
3. `src/components/retirement/AssumptionsPanel.tsx`
4. `src/components/retirement/SavingsPlanEditor.tsx`
5. `src/components/retirement/ReturnAssumptionEditor.tsx`
6. `src/components/retirement/SpendingStrategyCard.tsx`
7. `src/components/retirement/RetirementChart.tsx`
8. `src/components/retirement/SummaryMetrics.tsx`
9. `src/components/retirement/YearlyDetailsTable.tsx`
10. `src/components/retirement/MiniProjectionPanel.tsx`
11. `src/components/retirement/ProjectionSheet.tsx`

### Files to Modify

12. `**src/pages/RetirementPlanner.tsx**` -- Replace the placeholder with the full planner logic from the source project's `Index.tsx`. Key changes:
  - Keep `AppLayout` wrapper (the source project doesn't use it)
    - Remove the outer `min-h-screen bg-background` div (AppLayout provides this)
    - Remove the `mx-auto max-w-7xl px-4 py-8` wrapper (AppLayout's `p-6 max-w-7xl mx-auto` handles this)
    - Import all retirement components and simulation logic
    - Include all state management, validation, and rendering logic from the source

### What stays unchanged

- All existing UI components (Card, Badge, Input, Switch, Table, etc.) are already present in Capital Growth
- No new dependencies needed -- recharts is already in the project
- Sidebar menu item already exists and points to `/retirement-planner`
- No changes to Dashboard, Holdings, Transactions, Settings, or any portfolio logic

### Technical Details

The planner is entirely client-side with no backend dependencies. All 9 retirement components import from `@/components/ui/*` and `@/lib/retirement-simulation` -- paths that will resolve correctly in Capital Growth since both projects share the same alias structure.

The `useIsMobile` hook is already present in Capital Growth at `src/hooks/use-mobile.tsx`.

Additional guard rails for this import:

- If any imported component or utility depends on files not listed above, either copy those dependencies too or adapt the imports to existing equivalents in Capital Growth. Do not leave unresolved imports.

- Keep all planner state, local storage keys, helper functions, and styling isolated to the retirement planner page/components only.

- Adapt the imported planner to the existing Capital Growth route/file structure using RetirementPlanner.tsx as the page entry for /retirement-planner.

- Preserve the planner’s responsive behavior, but make it fit inside Capital Growth’s existing AppLayout content area. Do not introduce global overflow or page-level wrappers that affect other pages.

- Do not connect the planner to live portfolio data in this step. Keep it self-contained first.

- After import, verify that /retirement-planner renders without TypeScript/import errors, the form works, the chart renders, summary sections render, and existing Capital Growth pages remain unaffected.