

# NAV Pipeline Repair: Paginated Directory Loader + Queue Cleanup

## Root Cause (confirmed via logs)
`sync-nav` logs show **"Built projIdMap with 998 entries"** — the `sec_fund_directory` table has 14,411 rows but Supabase returns only the first 1,000. Funds like SCBRMLEQ and SCBGOLDHRMF fall outside this window, causing all downstream failures.

## Changes

### 1. New file: `supabase/functions/_shared/nav/load-sec-directory.ts`
Paginated helper that fetches ALL `sec_fund_directory` rows using `.range()` in a loop (page size 1,000). Returns `Map<string, string>` (normalized `proj_abbr_name` → `proj_id`). Logs total rows loaded and map entries built.

### 2. Update `supabase/functions/sync-nav/index.ts` (lines 151–168)
Replace the single `.select()` + manual map-building with:
```typescript
import { loadFullSecDirectory } from "../_shared/nav/load-sec-directory.ts";
// ...
projIdMap = await loadFullSecDirectory(supabase, "sync-nav");
```
Remove the `NORM` const (no longer needed locally) and the old `dirEntries` query block.

### 3. Update `supabase/functions/process-nav-backfill/index.ts` (lines 10, 153–164)
Same replacement — use `loadFullSecDirectory(supabase, "process-backfill")`. Remove the local `NORM` const on line 10.

### 4. Update `supabase/functions/backfill-nav/index.ts` (lines 250–262)
Same replacement — use `loadFullSecDirectory(supabase, "backfill")`. Remove local `NORM` and map-building.

### 5. Update `src/hooks/use-import-transactions.ts` (lines 42–53)
This is a **frontend** query, so it can't use the shared Deno helper. Apply the same pagination pattern inline:
```typescript
// Paginate sec_fund_directory (14k+ rows exceed default 1000 limit)
const allSecEntries: typeof secEntries = [];
let offset = 0;
while (true) {
  const { data, error } = await supabase
    .from('sec_fund_directory')
    .select('proj_id, proj_abbr_name, proj_name_en, proj_name_th, amc_name')
    .range(offset, offset + 999);
  if (error) { warnings.push('...'); break; }
  if (!data || data.length === 0) break;
  allSecEntries.push(...data);
  if (data.length < 1000) break;
  offset += 1000;
}
```

### 6. Update `src/hooks/use-holdings.ts` (line 14)
Add `.limit(5000)` to the `nav_history` query, keeping the existing explicit ordering so JS-side deduplication reliably uses newest rows first:
```typescript
supabase.from('nav_history')
  .select('fund_id, nav_per_unit, nav_date')
  .order('fund_id')
  .order('nav_date', { ascending: false })
  .limit(5000),
```
Comment noting this is a temporary safety net.

### 7. Update `src/hooks/use-check-nav-coverage.ts` (after line 31)
Before inserting a new backfill job, check for a same-day failed job for the same fund:
```typescript
// Skip re-enqueue if a failed job for this fund already exists from today
// (prevents queue pollution; will auto-clear next day for retry)
const todayStart = `${today}T00:00:00Z`;
const { data: recentFailed } = await supabase
  .from("nav_backfill_queue")
  .select("id")
  .eq("fund_id", fundId)
  .eq("status", "failed")
  .gte("updated_at", todayStart)
  .limit(1);

if (recentFailed && recentFailed.length > 0) {
  return false;
}
```
This only blocks same-day re-enqueue. Tomorrow (or after the root cause fix is deployed), new transactions will enqueue fresh jobs normally.

### 8. Database cleanup (via migration)
```sql
-- Clean up failed jobs (targeted: only delete failed, preserve completed history)
DELETE FROM nav_backfill_queue WHERE status = 'failed';

-- Reset stuck processing jobs (older than 10 minutes) back to pending
-- Log count via RAISE NOTICE for visibility
DO $$
DECLARE
  reset_count integer;
BEGIN
  UPDATE nav_backfill_queue
  SET status = 'pending', updated_at = now()
  WHERE status = 'processing'
    AND updated_at < now() - interval '10 minutes';
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RAISE NOTICE 'Reset % stuck processing jobs back to pending', reset_count;
END $$;
```

## Files Summary

| File | Change |
|------|--------|
| `supabase/functions/_shared/nav/load-sec-directory.ts` | **New** — paginated loader with logging |
| `supabase/functions/sync-nav/index.ts` | Use shared loader |
| `supabase/functions/process-nav-backfill/index.ts` | Use shared loader |
| `supabase/functions/backfill-nav/index.ts` | Use shared loader |
| `src/hooks/use-import-transactions.ts` | Inline pagination for frontend |
| `src/hooks/use-holdings.ts` | Add `.limit(5000)` safety net |
| `src/hooks/use-check-nav-coverage.ts` | Same-day failed job skip |
| Database migration | Delete failed jobs, reset stuck processing jobs |

## Post-deploy
After edge functions deploy, invoke `process-nav-backfill` to process any pending jobs. The corrected directory loader should now resolve SCBRMLEQ and SCBGOLDHRMF, allowing NAV history to populate.

