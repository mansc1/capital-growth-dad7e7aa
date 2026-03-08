

# Fix NAV Pending State — Ready to Implement

Three edits in `src/components/transactions/TransactionDrawer.tsx`:

## Edit 1: Schema (lines 39-40)
Replace `nav_at_trade: z.number().min(0)` with:
```ts
// 0 = pending historical NAV backfill placeholder, not a real NAV value.
// It satisfies the DB NOT NULL constraint while background backfill resolves the real NAV.
nav_at_trade: z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined) return 0;
    const num = Number(val);
    return Number.isNaN(num) ? 0 : num;
  },
  z.number().min(0)
),
```

## Edit 2: NAV autofill null branch (lines 160-163)
Replace `form.setValue("nav_at_trade", "" as any)` with `form.setValue("nav_at_trade", 0)`. Keep `form.clearErrors("nav_at_trade")`. Update comment to: `// No NAV available — use 0 as pending backfill placeholder and clear validation errors`

## Edit 3: NAV input (lines 498-508)
Display empty when value is 0, normalize with NaN guard:
```tsx
value={field.value === 0 ? "" : field.value}
onChange={(e) => {
  const raw = e.target.value;
  const num = raw === "" ? 0 : Number(raw);
  field.onChange(Number.isNaN(num) ? 0 : num);
  setNavManuallyEdited(true);
  navWasAutoFilled.current = false;
}}
```

No other changes. Computed units already gated by `watchNav > 0`. Helper text and toasts already correct.

