

# NAV System Health Dashboard — Implementation

## 3 Files

### 1. Create `src/hooks/use-nav-health.ts`
React Query hook, key `["nav_system_health"]`, `refetchInterval: 60_000`, `refetchOnWindowFocus: false`.

Exports `AlertSeverity`, `HealthAlert`, `NavHealthSummary` types + `useNavHealth` hook.

queryFn runs 4 isolated try/catch sections with safe defaults:

- **A (Coverage + Freshness)**: Parallel fetch funds, transactions, nav_history (limit 5000 with safety-cap comment), active backfill fund_ids. Build latestNavs map. Call `computeHoldings`. Count valuation statuses. Compute latestNavDate with empty guard. Count staleFunds (skip no-NAV funds).
- **B (Backfill)**: Query `nav_backfill_queue.status` filtered to `['pending','processing','failed']`, count in JS.
- **C (Sync)**: Query `sync_runs` ordered by `started_at desc` limit 1 — this is the most recent run overall, semantically correct for "Latest Sync".
- **D (Directory)**: Count `sec_fund_directory` with `head: true`.

Alerts built deterministically: errors first (`navUnavailable`, `failedJobs`), then warnings (`waitingForNav`, `staleFunds`). Empty array when no issues.

### 2. Create `src/components/settings/NavHealthDashboard.tsx`
Card with title "NAV System Health". Loading: `min-h-[280px]` skeleton grid. Content: 6 subsections in `grid-cols-2 sm:grid-cols-3`:
1. Coverage (tracked/ready/waiting/unavailable)
2. Freshness (latest NAV date, stale count)
3. Backfill Queue (pending/processing/failed)
4. Latest Sync (status badge, time, source with fallback for unknown providers)
5. Directory (funds indexed)
6. Alerts (green "No issues" or red/amber list)

Inline backfill indicator when jobs active.

### 3. Modify `src/pages/Settings.tsx`
Import and render `<NavHealthDashboard />` after line 149 (after NAV Data Maintenance card).

