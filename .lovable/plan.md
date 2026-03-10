

## Fix Add Transaction Submit — Per-Type Validation

**Single file:** `src/components/transactions/TransactionDrawer.tsx`

### Change 1 — Relax units schema (line 38)

```ts
// From:
units: z.number().min(0.0001, "Must be positive"),
// To:
units: z.number().min(0),
```

### Change 2 — Add per-type guards in `onSubmit` (insert between lines 290 and 292, before the sell-exceeds-held check)

```ts
// BUY/switch-in guard: amount must be positive
if (isBuyType && values.amount <= 0) {
  form.setError("amount", { message: "Amount must be positive" });
  return;
}

// SELL/switch-out guard: units must be positive
if (isSellType && values.units <= 0) {
  form.setError("units", { message: "Units must be positive" });
  return;
}
```

Using `isBuyType` (buy + switch_in) instead of `!isSellType` so dividends are not affected — reinvested dividends can legitimately have `amount = 0`.

### Summary

| What | Detail |
|------|--------|
| Schema | `units >= 0` allows pending-NAV buys |
| Buy guard | `isBuyType && amount <= 0` — only buy + switch_in |
| Sell guard | `isSellType && units <= 0` — only sell + switch_out |
| Dividend | Unaffected by either guard |
| Placement | Before sell-exceeds-held check (line 292) |
| Edit mode | Unchanged |

