

# Fix NAV Sync — Use sec_fund_directory for proj_id Resolution

## Changes (4 files)

### 1. `supabase/functions/_shared/nav/types.ts`
Add optional `projId` to `fetchLatestNavForFund` and optional `projIdMap` to `fetchLatestNavForFunds`.

### 2. `supabase/functions/_shared/nav/providers/mock.ts`
Update signatures to accept optional `projId`/`projIdMap` params (ignored).

### 3. `supabase/functions/_shared/nav/providers/sec.ts`
Full rewrite:
- **Remove** `buildProjIdMap()`, `resolveProjId()`, `projIdCache`, `factsApiKey`
- **Constructor**: Read `SEC_DAILY_API_KEY` first, fall back to `SEC_API_KEY`. Log which key is used: `[SEC] Using SEC_DAILY_API_KEY` vs `[SEC] Using SEC_API_KEY as fallback for Daily NAV`
- **New `NORM` helper**: `(s: string) => s.trim().toUpperCase()`
- **New `parseDailyNavResponse(data, fundCode, projId, dateStr)`**: Isolated response parser
  - If `data` is an array, use `data[0]` (handle array response shape)
  - Try field names in order: `last_val`, `nav`, `net_asset`
  - If none found, log keys **once**: `[SEC] Unexpected response shape for ${fundCode} proj_id=${projId} date=${dateStr}: keys=${Object.keys(record)}`
  - Returns `number | null`
- **`fetchLatestNavForFunds(fundCodes, projIdMap?)`**: If `projIdMap` is undefined/empty, **throw** `"projIdMap is required for SEC provider — ensure sec_fund_directory is populated"`. For each fundCode, lookup `projIdMap.get(NORM(fundCode))` — if missing, warn and skip. Call `fetchLatestNavForFund(fundCode, projId)` with resolved projId
- **`fetchLatestNavForFund(fundCode, projId)`**: Requires explicit `projId`. Log `[SEC] Fund ${fundCode} → proj_id ${projId}` once. Per-request log on non-204: `[SEC] ${fundCode} proj_id=${projId} date=${dateStr} → HTTP ${status}`. Use `parseDailyNavResponse` for parsing
- Keep `fetchWithRetry`, `delay`, retry/throttle constants unchanged

### 4. `supabase/functions/sync-nav/index.ts`
After loading active funds (step 2) and building `fundLookupCodes` (step 3), **before** calling the provider:

1. **Query `sec_fund_directory`**: `select('proj_id, proj_abbr_name')` — full table, structured for later `.in()` optimization
2. **Build `projIdMap`**: `Map<string, string>` using `NORM(proj_abbr_name) → proj_id`
3. **Pre-check resolution**: For each fund's `lookupCode`, check `projIdMap.has(NORM(lookupCode))`. If missing:
   - Directory empty → error: `"SEC fund directory is empty — sync the directory first via Settings"`
   - Directory has rows but no match → error: `"Fund ${fund.fund_code}: no matching entry in SEC fund directory for '${lookupCode}' (try refreshing the directory)"`
   - Increment `processedFunds` and `skippedFunds`, continue
4. **Filter resolved codes**: Only pass codes that resolved successfully to the provider — build `resolvedLookupCodes` (excludes skipped funds) so they are **not processed again** in the provider result flow
5. **Pass `projIdMap`** to `providerInstance.fetchLatestNavForFunds(resolvedLookupCodes, projIdMap)`
6. **Process results**: Only iterate over funds whose `lookupCode` was in `resolvedLookupCodes` — unresolved funds already counted as skipped above, not re-checked

Everything else (sync_runs tracking, nav_history upsert, snapshot rebuild) unchanged.

