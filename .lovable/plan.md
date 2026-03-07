

# Fix Orphan Funds and NAV Sync — Implementation Plan

## Problem
6 active orphan funds exist with zero transactions, causing NAV sync errors. SEC fund selection creates fund rows immediately even when transactions are cancelled.

## Changes

### 1. Database Migration — One-time Cleanup
**New file:** `supabase/migrations/20260307120000_archive_orphan_funds.sql`

```sql
UPDATE public.funds
SET is_active = false, updated_at = now()
WHERE is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t WHERE t.fund_id = funds.id
  );
```

### 2. TransactionDrawer — Defer Fund Creation
**File:** `src/components/transactions/TransactionDrawer.tsx` (full rewrite, preserving all existing behavior)

- Add `pendingSecFund: SecFundResult | null` state, import `X` icon and `toast` from sonner
- Change `fund_id` schema from `.min(1, "Select a fund")` to `.string()` — submit-time validation checks `!values.fund_id && !pendingSecFund`
- `resetPendingState()`: single function that resets `pendingSecFund`, `newFundLabel`, `navManuallyEdited`, `isEditInitialLoad`, `prevFundId`, `prevDate`
- `handleClose()`: calls `resetPendingState()` then `onClose()` — no duplication. Replaces all `onClose()` calls
- `clearPendingFund()`: clears `pendingSecFund`, `newFundLabel`, sets `fund_id` to `""`, calls `form.clearErrors("fund_id")` — returns UI fully to normal selection state
- `handleSecFundSelect`: checks active funds for normalized match. If found → use real `fund_id`, clear errors. If new → store in `pendingSecFund`, set `newFundLabel`, keep `fund_id` as `""`, clear errors
- NAV lookup: pass `undefined` as fundId when `pendingSecFund` is set
- Sell validation: skip current-units lookup when `pendingSecFund` is set; hide max units label
- Pending fund UI: bordered div with `"{name} (new — will be created on save)"` + X clear button + helper text. SEC search popover hidden while pending. Normal Select dropdown shown otherwise
- When user selects from dropdown: also clears `pendingSecFund`, `newFundLabel`, errors
- Edit populate effect: also resets `pendingSecFund`
- `onSubmit`: if `pendingSecFund` set → call `ensureFund(pendingSecFund)`. On fund creation success but tx save failure: set `fund_id` to real UUID, clear `pendingSecFund`/`newFundLabel`/errors (fully transitions to normal selected-fund state), show descriptive toast, keep form intact for retry. On full success: `resetPendingState()` then `onClose()`
- Submit button: "Creating fund…" while `isEnsuring && pendingSecFund`, disabled during `isSubmitting || isEnsuring`

### 3. Sync-nav — Filter to Transaction-backed Funds
**File:** `supabase/functions/sync-nav/index.ts` — replace step 2 (lines 97-114)

1. Query `SELECT DISTINCT fund_id FROM transactions`
2. Filter nulls with type guard: `const txFundIds: string[] = [...new Set((txRows ?? []).map(r => r.fund_id).filter((id): id is string => !!id))]`
3. If zero → record successful sync with `processed_count: 0`, return `{ success: true, processedFunds: 0, message: "No portfolio funds to sync" }`
4. Load active funds with `.eq("is_active", true).in("id", txFundIds)`
5. If zero after filter → same early success return
6. Rest of sync flow unchanged

### 4. Settings — Empty-state Toast
**File:** `src/pages/Settings.tsx` — lines 36-42

```typescript
if (result?.success && result.processedFunds === 0) {
  toast.info("No portfolio funds available for NAV sync yet.");
} else if (result?.success) {
  // existing success toast
}
```

## Files Changed

| File | Action |
|------|--------|
| `supabase/migrations/20260307120000_archive_orphan_funds.sql` | New |
| `src/components/transactions/TransactionDrawer.tsx` | Rewrite |
| `supabase/functions/sync-nav/index.ts` | Edit lines 97-114 |
| `src/pages/Settings.tsx` | Edit lines 36-42 |

