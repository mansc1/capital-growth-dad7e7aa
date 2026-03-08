

# Manage Funds — Final Implementation Plan

## Adjustment: sync-nav fund identity

The current sync-nav uses `codeToId` (fund_code → fund_id) to map provider results back. The plan replaces this with a per-fund iteration approach that avoids any reverse lookup map:

**New sync-nav flow:**
1. Select `id, fund_code, sec_fund_code` from active funds
2. For each fund, compute `lookupCode = fund.sec_fund_code ?? fund.fund_code`
3. Collect all unique lookup codes, pass to provider's `fetchLatestNavForFunds(lookupCodes)`
4. When processing results, iterate over the **original fund records** — for each fund, find the matching result using that fund's own `lookupCode`. This keeps identity tied to the fund record, not a reverse map
5. Use `fund.id` directly for all nav_history operations

This avoids collisions if two funds share the same lookup code — each fund record drives its own processing.

## Everything else — unchanged from approved plan

### Migration
```sql
ALTER TABLE public.funds ADD COLUMN sec_fund_code text;
```

### New files
- **`src/hooks/use-fund-mutations.ts`** — CRUD mutations invalidating `['funds']`, `['holdings']`, `['holdings', true]`
- **`src/components/funds/FundDrawer.tsx`** — Sheet form for Add/Edit with Zod validation; warns on fund_code change if fund has history
- **`src/components/funds/ArchiveConfirmDialog.tsx`** — AlertDialog with extra warning when fund has active holdings
- **`src/pages/ManageFunds.tsx`** — Table with search, status tabs (Active/Archived/All), Edit/Archive/Restore actions, empty states

### Modified files
- **`src/types/portfolio.ts`** — Add `sec_fund_code: string | null` to Fund
- **`src/App.tsx`** — Add `/funds/manage` route before `/funds/:id`
- **`src/components/AppSidebar.tsx`** — Add "Manage Funds" nav item (FolderCog icon) after Transactions
- **`supabase/functions/sync-nav/index.ts`** — Select sec_fund_code, per-fund lookup code resolution, no reverse map

