

# Refactor: Inline Fund Creation in Transaction Flow

## Delete 3 files
- `src/pages/ManageFunds.tsx`
- `src/components/funds/FundDrawer.tsx`
- `src/components/funds/ArchiveConfirmDialog.tsx`

## Create 2 files

### `src/hooks/use-active-funds.ts`
Query active funds directly from database:
```ts
supabase.from('funds').select('*').eq('is_active', true).order('fund_code')
```
Query key: `['funds', 'active']`

### `src/hooks/use-ensure-fund.ts`
`useMutation`-based hook taking a `SecFundResult`. Steps:
1. Normalize: `const norm = result.proj_abbr_name.trim().toUpperCase()`
2. Fetch all funds, find match where `sec_fund_code?.trim().toUpperCase() === norm` OR `fund_code.trim().toUpperCase() === norm`
3. If found → return existing fund ID
4. If not → insert new fund (`fund_code = proj_abbr_name`, `sec_fund_code = proj_abbr_name`, `fund_name = proj_name_en || proj_name_th`, `amc_name`, `is_active: true`, `currency: THB`, nulls for category/asset_class/risk_level)
5. `await queryClient.invalidateQueries({ queryKey: ['funds'] })` and `await queryClient.invalidateQueries({ queryKey: ['funds', 'active'] })`
6. Return the fund ID

## Modify 5 files

### `src/App.tsx`
- Remove `ManageFunds` import and `/funds/manage` route

### `src/components/AppSidebar.tsx`
- Remove "Manage Funds" from `navItems`, remove `FolderCog` import
- Simplify `isActive` logic (remove the `/funds/manage` special case)

### `src/components/transactions/TransactionDrawer.tsx`
- Replace `useFunds` with `useActiveFunds`
- Add "Add from SEC Directory" button next to the fund Select dropdown
- Import `SecFundSearchPopover` and `useEnsureFund`
- When SEC result selected: call `ensureFund(result)` → set `fund_id` to returned ID
- Track a `newFundLabel` in local state so the dropdown shows the fund name before the query refetches

### `src/pages/Dashboard.tsx`
- After loading checks, if `!holdingsLoading && (!holdings || holdings.length === 0)`, early return with empty state:
  - Title: "No portfolio data yet"
  - Body: "Start by adding your first transaction and selecting a fund from the SEC directory."
  - CTA: Button navigating to `/transactions?add=1`
- This replaces charts/cards entirely for empty state (early return pattern per user's request)

### `src/pages/Holdings.tsx`
- Update empty state text and add CTA button navigating to `/transactions?add=1`

### `src/pages/Transactions.tsx`
- Read `?add=1` from URL on mount → open drawer, then `navigate('/transactions', { replace: true })` to clear param
- Update empty state text: "No transactions yet" / "Record your first buy, sell, or dividend transaction to start tracking your portfolio." / CTA opens drawer directly

