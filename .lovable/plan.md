

## Persist Retirement Simulation Inputs with localStorage

### Changes

**1. Create `src/lib/retirement-storage.ts`** — Small helper for safe read/write

- `STORAGE_KEY = "retirement_planner_state"`
- `loadInput(): SimulationInput | null` — parse JSON, validate it's an object with expected keys, return null on any error
- `saveInput(input: SimulationInput): void` — JSON.stringify and write

**2. Update `src/pages/RetirementPlanner.tsx`**

- Initialize `input` state with a lazy initializer: `useState(() => loadInput() ?? DEFAULT_INPUT)`
- Initialize `comparisonMode` similarly from localStorage (store alongside input or separately)
- Add a `useEffect` that saves `input` and `comparisonMode` to localStorage on change, debounced with a 500ms `setTimeout`
- Add a muted note below the page subtitle: `"Your inputs are saved automatically on this device."`

### Persisted state
- `input` (the full `SimulationInput` object — birth year, ages, savings ranges, return mode/ranges, spending mode, withdrawal rate, inflation, etc.)
- `comparisonMode` boolean

### Not persisted
- `sheetOpen` (transient UI state)
- All computed results (derived from input)

### Safety
- `loadInput` wrapped in try/catch — any parse error or missing keys returns null → defaults used
- Type guard checks that loaded object has `birthYear` as number before accepting

