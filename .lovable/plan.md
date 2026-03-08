

# Fix Transaction NAV UX — Implementation Plan

## Verification Complete

`nav_at_trade` is only displayed in two read-only table views (`Transactions.tsx:97`, `FundDetail.tsx:222`) as `formatNumber()`. It is **never** used in holdings calculations, portfolio snapshots, or return analytics — those all use `nav_history` lookups. The zero placeholder is safe and isolated.

## Changes — Single file: `src/components/transactions/TransactionDrawer.tsx`

### 1. Schema (line 39)
`nav_at_trade: z.number().min(0.0001, "Must be positive")` → `z.number().min(0)`
Add comment: `// 0 = pending historical NAV backfill placeholder, not a real NAV value`

### 2. Helper text — `renderNavHelper()` (lines 360-377)

**Existing fund, no nav (lines 361-368):**
- Create mode: `"No NAV found for this date. Save the transaction and historical NAV will be fetched automatically."`
- Edit mode: `"NAV for this date is not available yet. Saving will trigger an automatic historical NAV update."`

**Pending SEC fund, no resolved ID (lines 370-376):**
→ `"No NAV found for this date. Save the transaction and historical NAV will be fetched automatically."`

### 3. Post-save toast (lines 319-323)
Replace current block with:
```ts
if (result?.backfillEnqueued) {
  toast.success("Transaction saved. Historical NAV is being updated in the background.");
} else {
  toast.success(editTransaction ? "Transaction updated." : "Transaction saved.");
}
```
Always shows a toast. Background-update variant when backfill is enqueued.

### No other files changed

