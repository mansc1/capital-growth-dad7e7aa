

## Refactor Transaction Flow

### Change 1 — Use `useHoldings()` for sell validation (TransactionDrawer.tsx)

**Remove** lines 240-261 (the `currentUnits` state + useEffect that manually queries transactions).

**Replace with:**
```ts
import { useHoldings } from "@/hooks/use-holdings";

// Inside component:
const { data: holdings } = useHoldings();

// Derive currentUnits from holdings (used in sell validation + label)
const currentHolding = holdings?.find(h => h.fund.id === watchFundId);
const currentUnits = currentHolding?.total_units ?? 0;
```

No other sell validation changes needed — lines 299-308 already use `currentUnits` correctly.

### Change 2 — Explicit NAV in submit payload (TransactionDrawer.tsx)

In `onSubmit` (line 322-332), replace `nav_at_trade: values.nav_at_trade` with explicit resolution:

```ts
const navToSave = editTransaction
  ? values.nav_at_trade          // Edit mode: use form value (user may have edited)
  : (nav !== null && nav > 0)
    ? nav                         // Add mode: use resolved NAV
    : 0;                          // Add mode: placeholder for backfill

const payload = {
  ...values,
  fund_id: fundId,
  nav_at_trade: navToSave,
  // ... rest unchanged
};
```

This removes the dependency on the hidden form field being correctly set by effects in Add mode.

### Change 3 — Edit mode NAV pending helper (TransactionDrawer.tsx)

In the edit mode NAV input (lines 513-539), add helper text when `nav_at_trade === 0`:

Already handled by existing `renderNavHelper()` at line 535 — the case at lines 384-392 already shows "NAV for this date is not available yet..." when nav is null. No additional change needed since the edit input already shows empty when value is 0 (line 525: `value={field.value === 0 ? "" : field.value}`).

### What stays unchanged
- `use-holdings.ts` — no changes
- `use-transactions.ts` — no changes  
- NAV backfill, schema, analytics — untouched
- Add mode NAV display block (lines 541-551) — already shows the 3 states correctly
- Edit mode editable input — unchanged

### Summary of edits

**File: `src/components/transactions/TransactionDrawer.tsx`**
1. Add `import { useHoldings }` 
2. Add `const { data: holdings } = useHoldings()` inside component
3. Remove `useState<number>(0)` for currentUnits and the useEffect (lines 240-261)
4. Add derived `currentUnits` from holdings
5. Update payload construction in `onSubmit` to explicitly set `navToSave`

