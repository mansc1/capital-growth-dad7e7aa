## Add Plan System to Retirement Planner

### Summary

Create a localStorage-based plan save/restore system with three parts: a storage helper, a plan status + history UI component, and integration into the existing planner page.

### File 1: `src/lib/retirement-plan-storage.ts` — Storage Helpers

```ts
type SavedRetirementPlan = {
  id: string;          // crypto.randomUUID()
  savedAt: string;     // ISO timestamp
  input: SimulationInput;
};
```

Exports:

- `loadActivePlan(): SavedRetirementPlan | null` — parse from `retirement_active_plan`, validate shape, return null on error
- `saveActivePlan(plan): void` — write to `retirement_active_plan`
- `loadPlanHistory(): SavedRetirementPlan[]` — parse from `retirement_plan_history`, return `[]` on error
- `pushPlanToHistory(plan): void` — prepend to history, cap at 5, save

All wrapped in try/catch for safety.

### File 2: `src/components/retirement/PlanStatusCard.tsx` — UI Component

A single Card component with two sections:

**Top section — Status + Action:**

- If no active plan or draft differs from active: show muted "Draft plan" label + primary "Set as My Plan" button
- If draft matches active: show "Using your active plan" label (green tint), button disabled or hidden
- Comparison: `JSON.stringify(input) === JSON.stringify(activePlan.input)`

**Bottom section — Plan History:**

- Compact list of up to 5 saved plans, newest first
- Each row: formatted date + summary line (`Retire at {retirementAge} • Target {targetAge}`) + "Load" button
- If no history, show nothing or muted "No saved plans yet"

Props: `{ input, activePlan, history, onConfirm, onLoadPlan }`

### File 3: `src/pages/RetirementPlanner.tsx` — Integration

**New state (loaded from localStorage on mount):**

```ts
const [activePlan, setActivePlan] = useState<SavedRetirementPlan | null>(loadActivePlan);
const [planHistory, setPlanHistory] = useState<SavedRetirementPlan[]>(loadPlanHistory);
```

**Confirm handler:**

```ts
const handleConfirmPlan = () => {
  const plan = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), input };
  saveActivePlan(plan);
  pushPlanToHistory(plan);
  setActivePlan(plan);
  setPlanHistory(loadPlanHistory());
  toast({ title: "Plan saved", description: "Your active plan has been updated." });
};
```

**Load handler:**

```ts
const handleLoadPlan = (plan: SavedRetirementPlan) => {
  setInput(plan.input); // restores as draft, simulation updates automatically
};
```

**Render placement:**

- Desktop: Add `<PlanStatusCard>` in the left column (col-span-7), between the header and the first input section
- Mobile: Same position, below header

### What stays unchanged

- `retirement-simulation.ts` — no changes
- `retirement-storage.ts` — continues autosaving draft as before
- All scoring, chart, and simulation logic

All other pages and components  
Additional guard rails:

- Keep draft autosave storage and active-plan storage fully separate. Loading a historical plan should only update the current draft input, not overwrite the active plan unless the user explicitly clicks "Set as My Plan".

- Add a lightweight toast on load, e.g. "Plan loaded as draft".

- If convenient, replace raw JSON.stringify comparison with a small helper like isSamePlanInput(a, b) for readability and future safety.

- If crypto.randomUUID is not guaranteed in all target environments, add a simple fallback ID generator.