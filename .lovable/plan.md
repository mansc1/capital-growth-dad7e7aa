## SEC Open API v1/Legacy to v2 Migration

### A. Audit — All SEC API Touchpoints

There are **4 files** that directly call SEC API endpoints, plus **2 shared utilities** and **1 frontend search** that use the cached data:

```text
File                                          | SEC Endpoints Used                                              | Auth Header
----------------------------------------------|----------------------------------------------------------------|-----------------------------
supabase/functions/sync-sec-fund-directory/    | GET api.sec.or.th/FundFactsheet/fund/amc                       | Ocp-Apim-Subscription-Key
  index.ts                                    | GET api.sec.or.th/FundFactsheet/fund/amc/{unique_id}            | Ocp-Apim-Subscription-Key
                                              |                                                                |
supabase/functions/_shared/nav/providers/      | GET api.sec.or.th/FundDailyInfo/{proj_id}/dailynav/{nav_date}   | Ocp-Apim-Subscription-Key
  sec.ts                                      |                                                                |
                                              |                                                                |
supabase/functions/backfill-nav/index.ts       | GET api.sec.or.th/FundDailyInfo/{proj_id}/dailynav/{dateStr}    | Ocp-Apim-Subscription-Key
                                              |                                                                |
supabase/functions/process-nav-backfill/       | GET api.sec.or.th/FundDailyInfo/{proj_id}/dailynav/{dateStr}    | Ocp-Apim-Subscription-Key
  index.ts                                    |                                                                |
```

**Indirect consumers (no direct SEC calls, use cached data only):**

- `supabase/functions/_shared/nav/load-sec-directory.ts` — reads `sec_fund_directory` table
- `supabase/functions/search-sec-funds/index.ts` — queries `sec_fund_directory` table
- `src/hooks/use-sec-fund-search.ts` — invokes `search-sec-funds` edge function
- `supabase/functions/sync-nav/index.ts` — delegates to SEC provider via `getNavProvider()`
- `supabase/functions/update-nav-data/index.ts` — orchestrates the above functions

**Secrets used:** `SEC_API_KEY`, `SEC_DAILY_API_KEY` (optional override)

### B. Migration Map — v1/Legacy → v2

Based on the SEC announcement, the migration involves:

1. **Base URL change**: `api.sec.or.th` → `open-api.sec.or.th`
2. **API key header**: `Ocp-Apim-Subscription-Key` remains the same (standard Azure APIM pattern, carried over to new portal)
3. **Pagination support**: New v2 APIs add optional pagination for large result sets
4. **Response schema**: Field names remain the same based on the changelog (no breaking field renames documented)

```text
Current (Legacy)                                                    | v2 Replacement
--------------------------------------------------------------------|------------------------------------------------------------
GET api.sec.or.th/FundFactsheet/fund/amc                            | GET open-api.sec.or.th/v2/FundFactsheet/fund/amc
GET api.sec.or.th/FundFactsheet/fund/amc/{id}                       | GET open-api.sec.or.th/v2/FundFactsheet/fund/amc/{id}
GET api.sec.or.th/FundDailyInfo/{proj_id}/dailynav/{date}           | GET open-api.sec.or.th/v2/FundDailyInfo/{proj_id}/dailynav/{date}
```

### C. Implementation Plan

The key insight: all SEC API calls are scattered across 4 files with duplicated `fetchWithRetry`, URL construction, header management, and response parsing. The migration should **centralize** this into a shared SEC client.

**1. Create `supabase/functions/_shared/sec-api/client.ts**` — Centralized SEC API client

- Export a `SecApiClient` class or config object with:
  - `SEC_BASE_URL` constant: `"https://open-api.sec.or.th/v2"` (configurable via env `SEC_API_BASE_URL` with fallback, enabling rollback)
  - Shared `fetchWithRetry()` (move from duplicated copies)
  - `getApiHeaders()` returning `{ "Ocp-Apim-Subscription-Key": key, Accept: "application/json" }`
  - `fetchDailyNav(projId, dateStr)` — returns parsed NAV or null
  - `fetchAmcList()` — returns AMC array
  - `fetchFundsByAmc(amcId)` — returns fund array
  - `parseDailyNavResponse(data)` — consolidated from 3 duplicate copies

**2. Update `supabase/functions/sync-sec-fund-directory/index.ts**`

- Import `SecApiClient` from shared module
- Replace inline `fetchWithRetry`, API URL construction, and header management
- Use `client.fetchAmcList()` and `client.fetchFundsByAmc(id)`
- Remove duplicated `fetchWithRetry` function

**3. Update `supabase/functions/_shared/nav/providers/sec.ts**`

- Import `SecApiClient` from shared module
- Replace inline URL construction and `fetchWithRetry`
- Use `client.fetchDailyNav(projId, dateStr)`
- Remove duplicated `fetchWithRetry`, `parseDailyNavResponse`

**4. Update `supabase/functions/backfill-nav/index.ts**`

- Import shared client
- Replace inline `fetchWithRetry`, `parseDailyNavResponse`, URL construction (~300 lines simplified)
- Use `client.fetchDailyNav(projId, dateStr)`

**5. Update `supabase/functions/process-nav-backfill/index.ts**`

- Same as above — import shared client, replace duplicated code

### What stays unchanged

- `sec_fund_directory` table schema — no changes
- `nav_history` table schema — no changes
- All frontend components and hooks
- `search-sec-funds` edge function (queries local DB, no SEC API calls)
- `sync-nav/index.ts` (delegates to provider, no direct SEC calls)
- `update-nav-data/index.ts` (orchestrates other functions, no direct SEC calls)
- `load-sec-directory.ts` (queries local DB only)
- All portfolio analytics, dashboard, and retirement planner logic

### Rollback safety

The `SEC_API_BASE_URL` environment variable allows switching back to `https://api.sec.or.th` without code changes if v2 has issues before the June 30 deadline.

### Important caveat

The new SEC Open Data developer portal (`secopendata.sec.or.th`) is a JS-rendered SPA that cannot be scraped for exact v2 documentation. The v2 URL pattern `open-api.sec.or.th/v2/...` is based on the SEC announcement's stated convention. **You will need to verify the exact v2 base URL against your SEC developer portal account before deploying.** The implementation will use an environment variable (`SEC_API_BASE_URL`) so the URL can be updated without code changes.

### Technical details

- 5 files modified/created
- ~200 lines of duplicated `fetchWithRetry` + `parseDailyNavResponse` consolidated into 1 shared module
- Environment variable `SEC_API_BASE_URL` defaults to `https://open-api.sec.or.th/v2` with fallback to legacy URL
- No schema migrations required
- No new secrets required (same `SEC_API_KEY` / `SEC_DAILY_API_KEY`)

Before implementation, verify the exact v2 endpoint paths, base URL, headers, and response schemas against the SEC developer portal/documentation available to this account. Do not hard-code the proposed v2 URLs unless they are confirmed from the official portal docs.

If exact v2 mappings cannot be confirmed from the portal during this task, stop after producing:

1. the audited SEC API touchpoint list,

2. the confirmed migration map,

3. the minimal file-by-file implementation diff plan.

Also, only modify files that contain confirmed direct SEC HTTP calls. If a file only delegates to a shared provider/client layer, do not refactor it unnecessarily.