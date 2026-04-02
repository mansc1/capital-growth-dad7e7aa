

## Make SEC Connectivity Failure Visible and Actionable in Settings UI

### Summary

Enhance the NAV Health Dashboard to clearly surface SEC connectivity failures with specific messaging, add a standalone "Test SEC Connection" button, prioritize network alerts over downstream symptoms, and add a collapsible diagnostics section.

### Changes

**1. `src/hooks/use-sec-connectivity.ts`** — New hook for standalone connectivity test

- Call the `update-nav-data` edge function with a query param like `?connectivityOnly=true`, or create a tiny new edge function `check-sec-connectivity` that only runs `SecApiClient.checkConnectivity()` and returns the result
- Prefer a new minimal edge function (`check-sec-connectivity`) to avoid triggering any sync logic
- Returns `{ reachable: boolean; error?: string; category?: string; isLoading: boolean; check: () => Promise<void> }`

**2. `supabase/functions/check-sec-connectivity/index.ts`** — New lightweight edge function

- Import `SecApiClient` from shared client
- Instantiate, call `checkConnectivity()`
- Return JSON: `{ reachable, error, category, baseUrl (masked) }`
- No sync, no DB writes, no auth required
- CORS headers as usual

**3. `src/hooks/use-nav-health.ts`** — Prioritize SEC connectivity alerts

- In the alerts builder, move the `secUnreachable` alert to the **top** of the alerts array (before navUnavailable, failedJobs)
- When `secUnreachable` is present, downgrade `navUnavailable` and `staleFunds` alerts from their current severity to supplementary context (keep them but move after the SEC alert)
- Expose a computed `secUnreachable: boolean` flag on `NavHealthSummary` for easy consumption

**4. `src/components/settings/NavHealthDashboard.tsx`** — Major UI enhancements

- **Health banner**: When `data.secUnreachable` is true, override the banner to show "SEC API unreachable" with body text: "The sync runtime could not reach the SEC API. Your existing portfolio data is unchanged, but NAV refresh cannot complete right now."
- **Latest Sync section**: Below the SyncStatusBadge, when `syncStatus === "failed"` and `syncErrorMessage` exists, show a diagnostic line: "Failure reason: SEC API unreachable from sync runtime" (or auth-specific, or raw message as fallback). Derive the label from `syncErrorMessage` keywords (dns/network → "SEC API unreachable", auth → "SEC API authentication failed", else → truncated raw message)
- **Test SEC Connection button**: Add a secondary/ghost button next to "Update NAV Data". On click, call the `useSecConnectivity` hook's `check()`. Show toast with result: success → "SEC API is reachable", network → "SEC API could not be reached from the sync runtime", auth → "SEC API reachable, but authentication failed"
- **Collapsible diagnostics**: Below alerts, add a small `<details>` or similar collapsible section labeled "Diagnostics" showing: error category, secReachable flag, last sync timestamp, and a truncated error snippet (first 120 chars of `syncErrorMessage`). Only render when `syncStatus === "failed"`

**5. Alert ordering in the Alerts grid cell**

- SEC connectivity alert first (if present)
- Then failed jobs
- Then nav unavailable
- Then stale/waiting

### File summary

| File | Action |
|------|--------|
| `supabase/functions/check-sec-connectivity/index.ts` | Create |
| `src/hooks/use-sec-connectivity.ts` | Create |
| `src/hooks/use-nav-health.ts` | Modify (alert priority, `secUnreachable` flag) |
| `src/components/settings/NavHealthDashboard.tsx` | Modify (banner, failure reason, test button, diagnostics) |

### What stays unchanged
- All sync/NAV logic, score computation, simulation
- update-nav-data edge function
- All other pages and hooks

