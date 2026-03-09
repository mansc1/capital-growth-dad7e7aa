

# Fix: Add Transaction button blocked by units validation

## Root Cause

The Zod schema requires `units: z.number().min(0.0001, "Must be positive")`. In Add mode for buy/switch_in types:

1. NAV is not available (shows "Historical NAV will be fetched automatically")
2. Units are computed from `amount / nav` — but since NAV = 0, the computation is skipped
3. Units stays at `0`, which fails the `.min(0.0001)` validation
4. `form.handleSubmit` silently blocks submission — no visible error because the units field isn't even rendered for buy types

Same issue applies when NAV IS available but amount is 0.

## Fix

In `src/components/transactions/TransactionDrawer.tsx`:

**Line 37** — Change units validation to allow 0:
```ts
units: z.number().min(0),
```

**In `onSubmit` (line 284)** — Add manual validation for cases where units must be positive:
- For sell/switch_out types: units must be > 0 (already has sell validation)
- For buy/switch_in when NAV is available: warn if amount is 0 but still allow save

This matches the architecture: for buys, units are resolved later when NAV becomes available via the write-back pipeline. The DB stores `units=0` temporarily, similar to `nav_at_trade=0`.

**Alternative simpler approach**: Use `z.number().min(0)` for units and add explicit sell-type validation in `onSubmit` (which already exists at line 292). This is the cleanest fix since:
- Buy types: units=0 is valid (will be computed when NAV arrives)
- Sell types: already validated manually at line 292
- The `.min(0.0001)` guard was overly strict for the new system-managed NAV flow

### Single change needed

Line 37: `units: z.number().min(0.0001, "Must be positive")` → `units: z.number().min(0)`

