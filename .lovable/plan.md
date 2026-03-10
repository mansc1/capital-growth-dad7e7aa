

# Refactor Add vs Edit Transaction NAV UX

## Single file: `src/components/transactions/TransactionDrawer.tsx`

### Change 1 — Add `formatNumber` import (line 19)
```ts
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import { formatNumber } from "@/lib/format";
```

### Change 2 — Replace NAV field block (lines 500-525)

Replace the single `FormField` with a conditional:

```tsx
{editTransaction ? (
  <FormField
    control={form.control}
    name="nav_at_trade"
    render={({ field }) => (
      <FormItem>
        <FormLabel>NAV at Trade</FormLabel>
        <FormControl>
          <Input
            type="number"
            step="0.0001"
            {...field}
            value={field.value === 0 ? "" : field.value}
            onChange={(e) => {
              const raw = e.target.value;
              const num = raw === "" ? 0 : Number(raw);
              field.onChange(Number.isNaN(num) ? 0 : num);
              setNavManuallyEdited(true);
              navWasAutoFilled.current = false;
            }}
          />
        </FormControl>
        {renderNavHelper()}
        <FormMessage />
      </FormItem>
    )}
  />
) : (
  <div className="space-y-2">
    <Label className="text-sm font-medium">NAV at Trade</Label>
    <div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
      {navLoading || isResolving
        ? "Looking up NAV…"
        : nav !== null && nav > 0
          ? formatNumber(nav)
          : "Historical NAV will be fetched automatically after saving."}
    </div>
  </div>
)}
```

### What stays unchanged
- All `useEffect` hooks for NAV autofill and units calculation
- `nav_at_trade` stays in form state (set via `useEffect`, submitted at save time)
- `renderNavHelper()` function definition (only called in Edit branch now)
- Write-back logic, save hooks, schema, all other form fields

### Why this works
- **Add mode**: NAV field is read-only display. The existing `useEffect` at line 158 still sets `form.setValue("nav_at_trade", ...)` so the form value is correct at submit time. If NAV is unavailable, it stays 0 (placeholder) and write-back fills it later.
- **Edit mode**: Completely unchanged — editable input with manual override and helper text.

