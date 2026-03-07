

# NAV Autofill for Pending SEC Funds

## Changes

### 1. New file: `src/hooks/use-resolve-fund-id-by-sec-code.ts`

React Query hook that resolves a `fund_id` from the `funds` table (active or inactive) by exact normalized `sec_fund_code` match.

- Normalizes input with `.trim().toUpperCase()`; query key uses normalized value
- Fetches all funds with `sec_fund_code`, matches client-side for exact comparison (no partial match risk)
- Uses `.order('created_at', { ascending: true })` for predictable first-match when duplicates exist
- Returns `{ resolvedFundId: string | undefined, isResolving: boolean }`
- Structured so the query can be swapped to server-side filter later if the table grows

### 2. Edit: `src/components/transactions/TransactionDrawer.tsx`

**2a. Import** — add after line 17:
```typescript
import { useResolveFundIdBySecCode } from "@/hooks/use-resolve-fund-id-by-sec-code";
```

**2b. New ref** — add after line 62:
```typescript
const prevSecCode = useRef<string>("");
```

**2c. Derived constant** — add after line 88 (`isDividend`):
```typescript
const pendingSecCode = pendingSecFund?.proj_abbr_name?.trim().toUpperCase() ?? "";
```

**2d. Update `resetPendingState`** (line 91-98) — add `prevSecCode.current = "";` before closing brace.

**2e. Update tracking effect** (lines 119-132) — add `secCodeChanged` tracking using `pendingSecCode`:
```typescript
useEffect(() => {
  const fundChanged = watchFundId !== prevFundId.current;
  const dateChanged = watchDate !== prevDate.current;
  const secCodeChanged = pendingSecCode !== prevSecCode.current;

  if (fundChanged || dateChanged || secCodeChanged) {
    if (prevFundId.current || prevDate.current || prevSecCode.current) {
      setNavManuallyEdited(false);
      isEditInitialLoad.current = false;
    }
    prevFundId.current = watchFundId;
    prevDate.current = watchDate;
    prevSecCode.current = pendingSecCode;
  }
}, [watchFundId, watchDate, pendingSecCode]);
```

**2f. Replace navFundId logic** (lines 134-136):
```typescript
const { resolvedFundId, isResolving } = useResolveFundIdBySecCode(
  pendingSecFund ? pendingSecFund.proj_abbr_name : undefined
);
const navFundId = pendingSecFund ? resolvedFundId : watchFundId;
const { nav, navDateUsed, isExactMatch, isLoading: navLoading } = useNavForTradeDate(navFundId, watchDate);
```

**2g. Replace `renderNavHelper`** (lines 318-350) — loading branch first to prevent flash; pending-only fallback last:
```typescript
function renderNavHelper() {
  if ((navLoading || isResolving) && (navFundId || pendingSecFund) && watchDate) {
    return <p className="text-xs text-muted-foreground">Looking up NAV…</p>;
  }
  if (!navLoading && nav !== null && isExactMatch && !navManuallyEdited) {
    return <p className="text-xs text-muted-foreground">NAV auto-filled from {navDateUsed}</p>;
  }
  if (!navLoading && nav !== null && !isExactMatch && !navManuallyEdited) {
    return (
      <p className="text-xs text-amber-600 dark:text-amber-400">
        Using latest available NAV from {navDateUsed} (trade date: {watchDate})
      </p>
    );
  }
  if (!navLoading && nav === null && navFundId && watchDate) {
    return (
      <p className="text-xs text-muted-foreground">
        {isBuyType || isSellType
          ? "No NAV found for this fund. Enter NAV manually or sync NAV data first."
          : "No NAV found for this date. Enter NAV manually."}
      </p>
    );
  }
  if (pendingSecFund && !resolvedFundId && !isResolving) {
    return (
      <p className="text-xs text-muted-foreground">
        No NAV found for this fund yet. Enter NAV manually or sync NAV data after saving.
      </p>
    );
  }
  return null;
}
```

Helper text intentionally disappears after manual NAV edits — consistent with existing behavior. Amber fallback styling preserved as-is.

## Files

| File | Action |
|------|--------|
| `src/hooks/use-resolve-fund-id-by-sec-code.ts` | New |
| `src/components/transactions/TransactionDrawer.tsx` | Edit ~25 lines |

No database changes. Deferred fund creation preserved.

