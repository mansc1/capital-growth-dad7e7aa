

# Implement Unified "Update NAV Data" Action

## 4 Files

### 1. Create `supabase/functions/update-nav-data/index.ts`

Best-effort orchestration. CORS headers same pattern as sync-nav. Auth: validate `apikey` header against `SUPABASE_ANON_KEY` env var (same as sync-sec-fund-directory pattern).

**Step 1 — Directory refresh**: Internal fetch to `${supabaseUrl}/functions/v1/sync-sec-fund-directory` with `apikey` and `Authorization: Bearer` headers set to anon key. Try/catch; on failure, safely extract response body snippet (up to 200 chars) into `warnings[]`, set `directoryRefreshed = false`. On success, parse JSON for `totalFunds`, set `directoryRefreshed = true`.

**Step 2 — NAV sync**: Internal fetch to `${supabaseUrl}/functions/v1/sync-nav` with `x-cron-secret` from `NAV_SYNC_CRON_SECRET` env var, `Content-Type: application/json`, body `{ trigger_type: "manual" }`. On failure, extract error body into warnings. On success, capture `insertedRows`, `updatedRows`, `skippedFunds`. Set `navSyncRan`.

**Step 3 — Gap detection** (extracted as `async function detectAndEnqueueBackfill(supabase)` for future optimization):
- Query all transactions via service role client → `select("fund_id, trade_date")`
- Group in JS: `Map<fundId, earliestTradeDate>` using `.substring(0, 10)` normalization
- For each fund:
  - Check `nav_history` for any row `.lte("nav_date", earliestDate).limit(1)` — if exists, skip
  - Check `nav_backfill_queue` for failed job from today (`.gte("updated_at", todayStart)`) — if exists, skip
  - Insert with `dedupe_key = "{fundId}:{earliestDate}:{today}"` — silently ignore `23505` (no warning)
  - On non-dedupe errors, push warning per fund and continue
- If any non-dedupe insert errors occurred, append summary warning: `"Historical NAV coverage may be incomplete for some funds."`
- Return `backfillJobsEnqueued` count

**Step 4 — Trigger processor**: Only if `backfillJobsEnqueued > 0`. Fetch `${supabaseUrl}/functions/v1/process-nav-backfill` with `apikey` header. If fetch fails, push warning `"Backfill jobs were enqueued but the processor could not be triggered: {error}. Jobs will be picked up on the next scheduled run."` and set `backfillProcessingTriggered = false`. Only set `true` on HTTP OK.

**Message building**: Compose descriptive clauses from each step result. E.g.:
- `"Directory refreshed (1234 funds)."` or `"Directory refresh failed."`
- `"NAV synced (5 inserted, 0 updated)."` or `"NAV sync failed."`
- `"2 backfill jobs queued."` or `"No historical gaps detected."`

`success = navSyncRan || directoryRefreshed`

### 2. Update `supabase/config.toml`

Add after existing `process-nav-backfill` entry:
```toml
[functions.update-nav-data]
verify_jwt = false
```

### 3. Create `src/hooks/use-update-nav-data.ts`

- `useState` for `isLoading`
- Invoke via `supabase.functions.invoke("update-nav-data")`
- On completion (success or failure), invalidate: `sync_runs`, `nav_history`, `all_nav_history`, `holdings`, `portfolio_snapshots`, `portfolio_time_series`, `latest_navs`, `backfill_queue_status`
- Return typed `UpdateNavDataResult | null` (null on network/invoke failure)

### 4. Rewrite `src/pages/Settings.tsx`

**Remove**: `useNavSync`, `useNavBackfill`, `supabase` import, `Database`/`History` icons, `refreshingDirectory` state, 3 handler functions, 3 NAV cards.

**Keep**: `useLastSuccessfulSync`, `useBackfillStatus`, `statusBadge` helper, Portfolio card unchanged.

**Add**: `useUpdateNavData`.

**Single "NAV Data Maintenance" card**:
- Description: "Refresh the SEC fund directory, sync the latest NAV, and fill any missing historical NAV automatically."
- 2x2 status grid:
  - **Data Source**: from `latestRun?.provider` mapped to display name
  - **Last Update Status**: `statusBadge(latestRun?.status)` — persisted state
  - **Last Successful Update**: timestamp from `lastSuccess?.completed_at`
  - **Background Jobs**: `backfillActiveCount > 0` → count, else "None"
- Error display if `latestRun?.status === "failed"`
- Inline backfill indicator: `<Loader2 className="h-4 w-4 animate-spin" /> Updating NAV history... (N jobs active)`
- Button: disabled only when `isLoading`. `<RefreshCw>` with `animate-spin` when loading. Text: "Update NAV Data" / "Updating..."

**Toast handler**:
- `null` result → `toast.error("NAV update failed. Check your connection and try again.")`
- `!result.success` → `toast.error("NAV update failed: " + result.message)`
- `result.success && backfillJobsEnqueued > 0` → `toast.success("NAV data updated. Historical NAV is being updated in the background.")`
- `result.success && backfillJobsEnqueued === 0` → `toast.success("NAV data updated successfully.")`
- `result.warnings.length > 0` → `toast.warning("Completed with " + result.warnings.length + " warning(s).")` — concise summary; full details in the returned result object and console log

| File | Action |
|------|--------|
| `supabase/functions/update-nav-data/index.ts` | Create |
| `supabase/config.toml` | Add entry |
| `src/hooks/use-update-nav-data.ts` | Create |
| `src/pages/Settings.tsx` | Rewrite NAV section |

