

# Fix Stale NAV Autofill on Empty Lookup

## Single file: `src/components/transactions/TransactionDrawer.tsx`

### 1. Add `navWasAutoFilled` ref (after line 64)

```typescript
const navWasAutoFilled = useRef(false);
```

### 2. Reset in `resetPendingState` (line 97–102)

Add `navWasAutoFilled.current = false;` after `isEditInitialLoad.current = false;`.

### 3. Replace autofill effect (lines 147–154)

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
  } else if (navWasAutoFilled.current) {
    // New lookup returned null — clear stale auto-filled value
    form.setValue("nav_at_trade", "" as any);
    navWasAutoFilled.current = false;
  }
}, [nav, navManuallyEdited, form]);
```

Uses `"" as any` instead of `0` — the HTML number input renders empty, and the existing zod schema (`z.number().min(0.0001)`) prevents submission without a valid NAV. This avoids `0` looking like a real value.

### 4. NAV input onChange (around line 375)

Add `navWasAutoFilled.current = false;` alongside the existing `setNavManuallyEdited(true)`:

```typescript
onChange={(e) => {
  field.onChange(Number(e.target.value));
  setNavManuallyEdited(true);
  navWasAutoFilled.current = false;
}}
```

### 5. Edit-mode populate effect (~line 191)

After `isEditInitialLoad.current = true;`, add:
```typescript
navWasAutoFilled.current = false;
```

### 6. New-transaction reset (~line 210)

After `isEditInitialLoad.current = false;`, add:
```typescript
navWasAutoFilled.current = false;
```

No changes to `renderNavHelper` — the helper text logic is already correct. The fix ensures the field value matches the helper text state.

