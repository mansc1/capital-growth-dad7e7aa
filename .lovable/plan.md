

# Fix: Remove `navWasAutoFilled` Guard from Clearing Branch

## Single change in `src/components/transactions/TransactionDrawer.tsx`

**Lines 149–164** — replace the autofill effect:

```typescript
// NAV autofill effect
useEffect(() => {
  if (navManuallyEdited || isEditInitialLoad.current) return;

  if (nav !== null) {
    const currentNav = form.getValues("nav_at_trade");
    if (currentNav !== nav) {
      form.setValue("nav_at_trade", nav);
      navWasAutoFilled.current = true;
    }
  } else {
    // New lookup returned null — clear stale auto-filled or DB-loaded value
    form.setValue("nav_at_trade", "" as any);
    form.clearErrors("nav_at_trade");
    navWasAutoFilled.current = false;
  }
}, [nav, navManuallyEdited, form]);
```

Two differences from current code:

1. `else if (navWasAutoFilled.current)` → `else` — removes the guard so stale DB-loaded values (edit mode after date change) are also cleared
2. Added `form.clearErrors("nav_at_trade")` — keeps validation state consistent with the newly emptied field

The existing `isEditInitialLoad.current` guard prevents clearing on mount; the tracking effect (lines 119–132) already resets `isEditInitialLoad` when fund/date/secCode changes, tying the clearing behavior to the current lookup context.

One file, ~2 lines changed.

