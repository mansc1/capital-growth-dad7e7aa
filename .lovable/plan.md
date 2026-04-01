## Add SEC Connectivity Diagnostics + Graceful Error Reporting

### Summary

Classify SEC fetch errors into structured categories, surface connectivity failures clearly in the sync result payload and NAV Health UI, and add a lightweight SEC reachability check to the update-nav-data orchestration.

### Changes

**1. `supabase/functions/_shared/sec-api/client.ts**` — Structured error categories

- Add an exported enum/union type `SecErrorCategory`: `"network"` | `"auth"` | `"empty_response"` | `"parse_error"` | `"unknown"`
- In `fetchWithRetry`, catch network/DNS errors and throw a typed error (or return a tagged result) with `category: "network"` and the raw message
- In `fetchDailyNav`, map the existing statuses to categories: `auth_error` → `"auth"`, `no_data` → `"empty_response"`, network catch → `"network"`
- Add a new method `checkConnectivity(logPrefix?)`: does a single lightweight fetch (e.g., HEAD or GET to the base URL) with a short timeout, returns `{ reachable: boolean; error?: string; category?: SecErrorCategory }`

**2. `supabase/functions/_shared/nav/providers/sec.ts**` — Track error categories per fund

- In `fetchLatestNavForFunds`, when a fund fails, capture the error category from the client
- Accumulate a summary: `{ networkErrors: number; authErrors: number; dataErrors: number }`
- Attach this summary to the thrown error or return it alongside results (add an optional `errorSummary` field to the return)

**3. `supabase/functions/sync-nav/index.ts**` — Surface connectivity in response

- After the provider call (line ~183), if all funds failed with network errors, set a top-level `secUnreachable: true` flag in the response JSON
- Add `errorCategory` field to the response: `"network"` | `"auth"` | `"partial"` | `null`
- Log: SEC base URL, error category, retry count, exact error string for each fund

**4. `supabase/functions/update-nav-data/index.ts**` — Pre-flight connectivity check + pass-through

- Before Step 2 (NAV sync), call `SecApiClient.checkConnectivity()` and log the result
- If unreachable, add a specific warning: `"SEC API is unreachable from the sync runtime (DNS/network error). NAV data cannot be refreshed at this time."`
- Still attempt sync (best-effort), but set a top-level `secReachable: false` in the response
- Pass through `secUnreachable` / `errorCategory` from sync-nav response

**5. `src/hooks/use-update-nav-data.ts**` — Extend result type

- Add optional fields to `UpdateNavDataResult`: `secReachable?: boolean`, `errorCategory?: string`

**6. `src/components/settings/NavHealthDashboard.tsx**` — Clearer failure messaging

- In `handleUpdateNavData`, check `result.secReachable === false`:
  - Show toast: "SEC API could not be reached. Your existing portfolio data is unaffected — only the NAV refresh was skipped."
- In `handleUpdateNavData`, check `result.errorCategory === "auth"`:
  - Show toast: "SEC API authentication failed. Check your API key subscription."
- Keep existing warning/success toasts for other cases
- In the alerts section, if sync failed with a network error category, show: "SEC API could not be reached from the sync runtime" instead of generic "X funds with no NAV data"

**7. `src/hooks/use-nav-health.ts**` — Pass sync error context

- When reading the latest sync_run, also read `error_message`
- Expose `syncErrorMessage: string | null` in `NavHealthSummary`
- In alerts generation, if `syncStatus === "failed"` and error message contains "dns" or "network" (case-insensitive), add an alert: `{ severity: "warning", key: "secUnreachable", message: "SEC API could not be reached during the last sync attempt" }`

### What stays unchanged

- NAV business logic, score computation, simulation
- All page layouts except the toast messages in NavHealthDashboard
- SEC API client base URL, retry logic structure
- All other pages and hooks  


Additional guard rails:

- In checkConnectivity(), prefer a lightweight GET over HEAD unless HEAD is confirmed to work reliably with the SEC gateway.

- Treat structured `errorCategory` from the shared SEC client as the primary source of truth. Use frontend string matching only as a fallback for older sync records.

- Only set `secUnreachable: true` at the top level when the sync run is dominantly or entirely blocked by network/DNS failures, not when only a subset of funds fail.

- If multiple error types occur in one sync run, expose `errorCategory` as the dominant category and keep a separate `errorSummary` object with per-category counts.

- Keep the pre-flight connectivity check best-effort only; do not skip the actual sync solely because the pre-flight check fails.

- Ensure UI copy clearly distinguishes network reachability issues, SEC auth/subscription issues, and empty/no-data responses.