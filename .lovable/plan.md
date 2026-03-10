

# NAV Write-Back Implementation

Five file changes, all line numbers confirmed.

## 1. NEW: `supabase/functions/_shared/nav/write-back-pending-transactions.ts`
Shared utility that updates `transactions.nav_at_trade` from `0` to real NAV for matching `fund_id` + `trade_date`. Returns count of updated rows.

## 2. EDIT: `supabase/functions/process-nav-backfill/index.ts`
- **Line 3**: Add import for `writeBackPendingTransactions`
- **After line 272** (`if (!updateErr) jobRowsUpdated++`): Add try/catch write-back block
- **After line 284** (`if (!insertErr) jobRowsInserted++`): Same write-back block

## 3. EDIT: `supabase/functions/sync-nav/index.ts`
- **Line 4**: Add import for `writeBackPendingTransactions`
- **After line 243** (`updatedRows++`): Add try/catch write-back block
- **After line 250** (`insertedRows++`): Same write-back block

## 4. EDIT: `src/pages/Transactions.tsx` — line 97
Replace `{formatNumber(Number(tx.nav_at_trade))}` with conditional showing neutral italic "Updating…" when `nav_at_trade === 0`.

## 5. EDIT: `src/components/transactions/TransactionDrawer.tsx` — line 211
Replace `isEditInitialLoad.current = true` with `isEditInitialLoad.current = Number(editTransaction.nav_at_trade) !== 0`.

## Write-back pattern (both edge functions)
```ts
try {
  const wb = await writeBackPendingTransactions(supabase, fund.id, dateStr, navPerUnit);
  if (wb > 0) console.log(`[write-back] Updated ${wb} transaction(s) for fund=${fund.id} date=${dateStr}`);
} catch (wbErr) {
  console.warn(`[write-back] Failed for fund=${fund.id} date=${dateStr}:`, (wbErr as Error).message);
}
```

