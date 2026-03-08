

# NAV Write-Back Implementation

## 5 file changes

### 1. NEW: `supabase/functions/_shared/nav/write-back-pending-transactions.ts`
Shared utility that updates `transactions.nav_at_trade` from `0` to the real NAV value for matching `fund_id` + `trade_date`. Returns count of updated rows.

### 2. EDIT: `supabase/functions/process-nav-backfill/index.ts`
- **Line 3**: Add import for `writeBackPendingTransactions`
- **After line 272** (`if (!updateErr) jobRowsUpdated++`): Add try/catch write-back call using `fund.id`, `dateStr`, `navPerUnit`
- **After line 284** (`if (!insertErr) jobRowsInserted++`): Same write-back call

### 3. EDIT: `supabase/functions/sync-nav/index.ts`
- **Line 4**: Add import for `writeBackPendingTransactions`
- **After line 243** (`updatedRows++`): Add try/catch write-back call using `fund.id`, `navResult.navDate`, `navResult.navPerUnit`
- **After line 250** (`insertedRows++`): Same write-back call

### 4. EDIT: `src/pages/Transactions.tsx` — line 97
Replace `formatNumber(Number(tx.nav_at_trade))` with conditional: show neutral italic "Updating…" when `nav_at_trade === 0`, otherwise formatted number.

### 5. EDIT: `src/components/transactions/TransactionDrawer.tsx` — line 211
Replace `isEditInitialLoad.current = true` with `isEditInitialLoad.current = Number(editTransaction.nav_at_trade) !== 0`

### Write-back pattern (used in both edge functions)
```ts
try {
  const wb = await writeBackPendingTransactions(supabase, fund.id, dateStr, navPerUnit);
  if (wb > 0) console.log(`[write-back] Updated ${wb} transaction(s) for fund=${fund.id} date=${dateStr}`);
} catch (wbErr) {
  console.warn(`[write-back] Failed for fund=${fund.id} date=${dateStr}:`, (wbErr as Error).message);
}
```

