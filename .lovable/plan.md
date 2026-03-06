

# Integrate SEC Thailand NAV Provider

## Summary
Replace mock NAV provider with production SEC Thailand API, add `provider` column to `sync_runs`, update Settings UI to show real provider. Six files modified, one migration.

## 1. Database Migration

Add `provider` column with safe backfill:

```sql
ALTER TABLE public.sync_runs ADD COLUMN provider text NOT NULL DEFAULT 'mock';
UPDATE public.sync_runs SET provider = 'mock' WHERE provider IS NULL;
```

The `DEFAULT 'mock'` handles existing rows, and the explicit `UPDATE` is extra safety for edge cases.

## 2. SEC Provider Rewrite (`supabase/functions/_shared/nav/providers/sec.ts`)

Full production implementation:

- **API key**: Read `SEC_API_KEY` from env. If missing, **throw** with clear error message (not silently return empty).
- **Fund code mapping**: `getFundLookupCode(fundCode)` helper — currently identity function, extensible later for `sec_fund_code` mapping.
- **Endpoint**: `GET https://api.sec.or.th/FundFactsheet/fund/daily?fund_code={code}`
- **Auth header**: `Ocp-Apim-Subscription-Key`
- **Retry helper** (`fetchWithRetry`):
  - 2 retries max
  - Retries on: network error, timeout, HTTP 429, 5xx
  - No retry on 4xx permanent errors
  - Exponential backoff: 500ms base
- **Timeout**: 15s per request via `AbortController`
- **Rate throttling**: Sequential requests, 200ms delay between funds
- **Parsing**:
  - Validate response is array
  - Sort by `nav_date` descending
  - Normalize date to `YYYY-MM-DD`
  - Parse `last_val` as float, reject non-positive
  - Return `null` for individual fund failures (log, don't throw)
- **Provider-level failures** (missing key): throw so sync-nav can catch and record

## 3. Provider Factory (`supabase/functions/_shared/nav/fetch-latest-nav.ts`)

Change return type to include provider name:
```typescript
export function getNavProvider(): { provider: NavProvider; providerName: string }
```
Returns `{ provider, providerName }` where providerName is `"sec"` or `"mock"`.

## 4. Sync Edge Function (`supabase/functions/sync-nav/index.ts`)

Key changes:
- Destructure `{ provider, providerName }` from `getNavProvider()`
- Create `sync_runs` row **immediately** with `provider: providerName` before calling the provider
- Wrap provider call (`fetchLatestNavForFunds`) in try/catch — if provider throws (e.g. missing SEC_API_KEY):
  - Mark sync_run as `failed` with clear `error_message` and `provider`
  - Return 500 failure response
- Include `provider: providerName` in all JSON responses and all sync_runs updates

## 5. Frontend Changes

**`src/hooks/use-nav-sync.ts`** — Add `provider?: string` to `SyncResult` interface.

**`src/hooks/use-sync-runs.ts`** — Add `provider: string` to `SyncRun` interface.

**`src/pages/Settings.tsx`** — Replace hardcoded "Mock" with dynamic provider from `latestRun?.provider`:
- `"sec"` → "SEC Thailand"
- `"mock"` → "Mock"
- fallback → "Unknown"

## 6. Secrets

Set `NAV_PROVIDER=sec` as a secret after code changes. The `SEC_API_KEY` will be requested from the user later — until then, sync will fail with a clear error message logged in `sync_runs`.

## Files Modified

| File | Change |
|------|--------|
| Migration | Add `provider` column to `sync_runs` |
| `_shared/nav/providers/sec.ts` | Full production rewrite |
| `_shared/nav/fetch-latest-nav.ts` | Return `{ provider, providerName }` |
| `functions/sync-nav/index.ts` | Wire provider name, early sync_run creation, provider error handling |
| `src/hooks/use-nav-sync.ts` | Add `provider` to SyncResult |
| `src/hooks/use-sync-runs.ts` | Add `provider` to SyncRun |
| `src/pages/Settings.tsx` | Dynamic provider display |

