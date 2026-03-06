

## Clean Empty State Implementation

### 1. Database Migration — Archive Demo Funds
Archive the 5 demo funds by setting `is_active = false`:
```sql
UPDATE public.funds SET is_active = false 
WHERE fund_code IN ('SCBSET', 'KFGTECH-A', 'B-INNOTECH', 'ONE-UGG-RA', 'KKP PGE-H') 
  AND is_active = true;
```

### 2. `src/hooks/use-funds.ts` — Add `useActiveFunds()`
Add a new hook that filters `is_active = true`. Used by TransactionDrawer and Transactions page to check fund availability.

### 3. `src/components/transactions/TransactionDrawer.tsx`
Change fund selector from `useFunds()` to `useActiveFunds()` so archived funds don't appear.

### 4. `src/pages/Dashboard.tsx` — Empty State
Check `holdings` (after loading) — if no active holdings exist, show empty state instead of charts:
- Title: "No portfolio data yet"  
- Body: "Start by adding your first fund and recording your first transaction."
- CTAs: "Add Fund" → `/funds/manage`, "Add Transaction" → `/transactions`

The check is based on absence of active holdings (`!holdings || holdings.length === 0`), not on holdings + snapshots both being empty.

### 5. `src/pages/Holdings.tsx` — Upgrade Empty State
Replace the minimal existing empty state with CTAs:
- Title: "No holdings yet"
- Body: "Once you add funds and record transactions, your holdings will appear here."
- CTAs: "Add Fund" → `/funds/manage`, "Add Transaction" → `/transactions`

### 6. `src/pages/Transactions.tsx` — Empty State + No-Funds Guard
- Import `useActiveFunds()` to check if active funds exist
- In header: disable "Add Transaction" button when no active funds, show tooltip/title guidance
- In empty state: if no active funds, adjust message to guide user to add a fund first; if funds exist, show standard "Add Transaction" CTA
- Empty state copy: "No transactions yet" / "Record your first buy, sell, or dividend transaction to start tracking your portfolio."

### 7. `src/pages/Settings.tsx` — Graceful No-Funds Sync
Import `useActiveFunds()`. When no active funds exist, show a subtle note below the sync button: "No active funds available for NAV sync."

### 8. `src/pages/ManageFunds.tsx` — Minor Polish
The existing empty state already matches spec well. Adjust copy to exactly match: "Add your first fund to start building your portfolio tracker."

### Files Changed

| File | Change |
|------|--------|
| Migration SQL | Archive 5 demo funds |
| `src/hooks/use-funds.ts` | Add `useActiveFunds()` |
| `src/components/transactions/TransactionDrawer.tsx` | Use `useActiveFunds()` |
| `src/pages/Dashboard.tsx` | Add empty state based on holdings absence |
| `src/pages/Holdings.tsx` | Upgrade empty state with CTAs |
| `src/pages/Transactions.tsx` | Add no-funds guard, upgrade empty state |
| `src/pages/Settings.tsx` | Add no-funds hint |
| `src/pages/ManageFunds.tsx` | Minor copy adjustment |

