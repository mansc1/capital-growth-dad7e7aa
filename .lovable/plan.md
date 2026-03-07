

# Historical NAV Backfill — Ready to Implement

All prior rounds of review are complete. The plan is fully specified. Here is the final implementation summary for the 3 files:

## 1. NEW: `supabase/functions/backfill-nav/index.ts`

Edge function secured via `x-cron-secret` (same pattern as sync-nav). Core flow:

- Auth via `x-cron-secret`, create `sync_runs` row with `job_name: "nav_backfill"`
- Compute `MIN(trade_date)` per fund from `transactions`, `MIN(nav_date)` per fund from `nav_history`
- For each fund with a gap: compute range, apply 365-day cap (`actualStart = max(requestedStart, endDate - 364)`), resolve `proj_id` from `sec_fund_directory`
- Unresolvable funds tracked in `unresolvedFunds[]` (separate from `apiErrors[]`)
- `fundsProcessed` = only funds that enter the resolved backfill loop
- `fundsSkipped` = funds with no gap (already covered)
- Per fund: preload existing `nav_history` rows for the date range into a `Map<dateStr, number>` to reduce round trips
- Iterate weekdays: call SEC API for every weekday (even if existing row exists, to detect changes)
  - `datesChecked` = count of actual SEC API requests
  - 204 response: increment `noDataDates`; if existing row exists for that date, log the inconsistency via `console.warn`
  - Got NAV: compare with preloaded map → same = `rowsSkipped`, different = update → `rowsUpdated`, not in map = insert → `rowsInserted`
- Throttle 200ms between API calls
- Update `sync_runs` with final counts

## 2. NEW: `src/hooks/use-nav-backfill.ts`

Client hook mirroring `use-nav-sync.ts`:
- Calls `backfill-nav` via `fetch()` with `x-cron-secret` header
- Typed `BackfillResult` interface
- Invalidates: `nav_history`, `all_nav_history`, `sync_runs`, `portfolio_snapshots`, `holdings`, `latest_navs`

## 3. MODIFIED: `src/pages/Settings.tsx`

Add new Card after SEC Fund Directory card:
- Title: "Historical NAV Backfill"
- Description explaining this is on-demand and may take several minutes
- Button with `History` icon, spinner while running
- Toast logic — one primary toast plus at most one combined warning toast:
  - Success: "Backfill complete: N inserted, N updated across N fund(s)"
  - No work needed: "All funds already have sufficient NAV coverage"
  - Combined warning (if any of capped/unresolved/apiErrors present): join lines like "N fund(s) capped at 365 days", "N fund(s) not in SEC directory", "N API error(s)" with ". " separator into one `toast.warning()`
  - Total failure: "Backfill failed"

## No schema changes needed

`sync_runs.job_name` already exists. `nav_history` has `UNIQUE(fund_id, nav_date)`.

