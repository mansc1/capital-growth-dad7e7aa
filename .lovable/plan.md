

# Smart Automatic NAV Backfill — Implementation

## 1. Database Migration

Create `nav_backfill_queue` table with partial unique index:

```sql
CREATE TABLE public.nav_backfill_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  requested_start_date date NOT NULL,
  requested_end_date date NOT NULL,
  reason text NOT NULL DEFAULT 'transaction_save',
  status text NOT NULL DEFAULT 'pending',
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_error text
);

CREATE UNIQUE INDEX uq_backfill_active_dedupe
  ON public.nav_backfill_queue (dedupe_key)
  WHERE status IN ('pending', 'processing');

ALTER TABLE public.nav_backfill_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.nav_backfill_queue FOR SELECT USING (true);
CREATE POLICY "Public write" ON public.nav_backfill_queue FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.nav_backfill_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

## 2. New Files

### `src/hooks/use-check-nav-coverage.ts`
- Exports `checkAndEnqueueBackfill(fundId: string, tradeDate: string): Promise<boolean>`
- Normalizes tradeDate to `YYYY-MM-DD` via `.substring(0, 10)`
- Queries `nav_history` for `fund_id = fundId AND nav_date <= tradeDate`, limit 1
- If coverage exists → return false
- If no coverage → insert into `nav_backfill_queue` with `dedupe_key = {fundId}:{normalizedDate}:{today}`, catch unique violation silently
- Fire-and-forget `supabase.functions.invoke('process-nav-backfill')` (no await on result)
- Return true

### `supabase/functions/process-nav-backfill/index.ts`
- Auth: accepts **either** valid `x-cron-secret` header **or** valid `apikey` header matching the actual anon key (`Deno.env.get('SUPABASE_ANON_KEY')`)
- CORS headers included
- Claims pending jobs: SELECT pending rows (limit 10, ordered by created_at), then for each: `UPDATE SET status = 'processing' WHERE id = X AND status = 'pending'` — the `AND status = 'pending'` guard prevents double-claiming
- For each claimed job: resolve `proj_id` from `sec_fund_directory`, fetch SEC API date-by-date (reuse same fetchWithRetry/throttle/parseDailyNavResponse logic from `backfill-nav`), upsert `nav_history`, mark `completed` or `failed`
- Track actual rows inserted/updated; only rebuild portfolio snapshot if data changed
- Return JSON summary

### `src/hooks/use-backfill-status.ts`
- `useQuery` with key `['backfill_queue_status']`
- `refetchInterval` callback: returns 5000 when `activeCount > 0`, `false` when 0
- Queries count of `nav_backfill_queue` where `status IN ('pending', 'processing')`
- Uses a `useRef` to track previous count; when transitioning from >0 to 0, invalidates `portfolio_time_series`, `nav_history`, `all_nav_history`, `holdings` queries
- Returns `{ activeCount, isLoading }`

## 3. Modified Files

### `supabase/config.toml`
Add:
```toml
[functions.process-nav-backfill]
verify_jwt = false
```

### `src/hooks/use-transactions.ts`
- Modify `useCreateTransaction` and `useUpdateTransaction` `mutationFn` to return `{ data, backfillEnqueued }` — after successful Supabase operation, call `checkAndEnqueueBackfill(data.fund_id, data.trade_date)` and capture the boolean result
- `onSuccess` unchanged

### `src/components/transactions/TransactionDrawer.tsx`
- After successful `createMutation.mutateAsync` or `updateMutation.mutateAsync`, check `result.backfillEnqueued`
- If true: `toast.info("Transaction saved. Historical NAV is being fetched in the background.")`

### `src/hooks/use-import-transactions.ts`
- After batch insert (step 4), collect unique `(fund_id, min_trade_date)` pairs from inserted rows
- Call `checkAndEnqueueBackfill` for each pair
- Add count of enqueued backfills to result warnings

### `src/hooks/use-nav-backfill.ts`
- Refactor `backfillNav()` to:
  1. Query all funds with transactions, find earliest trade_date per fund
  2. Call `checkAndEnqueueBackfill(fundId, earliestTradeDate)` for each
  3. Await `supabase.functions.invoke('process-nav-backfill')` (manual path waits)
  4. Invalidate queries on completion
  5. Return simplified result

### `src/pages/Settings.tsx`
- Import `useBackfillStatus`
- Show "Updating NAV history..." text + spinner near backfill button when `activeCount > 0`
- Disable backfill button when `activeCount > 0`

## Key Design Decisions

- **Auth consistency**: Processor validates `apikey` header value against actual `SUPABASE_ANON_KEY` env var, not just header presence. Accepts either that or valid `x-cron-secret`.
- **Date normalization**: `.substring(0, 10)` on all trade dates before coverage check and dedupe_key.
- **Range**: Transaction-save jobs: `tradeDate → today`. Manual: `earliestTxDate → today` per fund.
- **Polling cleanup**: `refetchInterval` callback returns `false` when idle. Transition-based invalidation via `useRef` prevents refetch noise.
- **Single gap-detection rule**: `checkAndEnqueueBackfill` is the only function used by all three paths (save, import, manual).
- **Backfill button guard**: Disabled when active queue jobs exist.

