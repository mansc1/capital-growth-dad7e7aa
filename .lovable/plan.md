

# Fix: Rebuild Portfolio Snapshots After Backfill

## Root Cause
`sync-nav` calls `rebuildPortfolioSnapshotsForToday(supabase)` after updating NAV data, but `backfill-nav` does not. This causes portfolio-level charts (which read from `portfolio_snapshots`) to show stale/incorrect data while fund-level charts (reading directly from `nav_history`) update correctly.

## Change: `supabase/functions/backfill-nav/index.ts`

Two modifications:

**1. Add import at line 1:**
```typescript
import { rebuildPortfolioSnapshotsForToday } from "../_shared/portfolio/rebuild-portfolio-snapshots.ts";
```

**2. Add snapshot rebuild after the fund processing loop (after line 407, before the sync_runs update):**
```typescript
    // 7. Rebuild portfolio snapshots if any NAV data changed
    if (result.rowsInserted > 0 || result.rowsUpdated > 0) {
      try {
        await rebuildPortfolioSnapshotsForToday(supabase);
      } catch (err) {
        const msg = `Snapshot rebuild failed: ${(err as Error).message}`;
        console.error(`[backfill] ${msg}`);
        result.apiErrors.push(msg);
      }
    }
```

This:
- Only triggers rebuild when backfill actually changed NAV data (`rowsInserted > 0 || rowsUpdated > 0`)
- Reports snapshot rebuild errors with a clear `"Snapshot rebuild failed: ..."` prefix, distinct from SEC API errors
- Does not fail the overall backfill job if rebuild fails

No other files need changes — the hook already invalidates `portfolio_snapshots` in its query invalidation list.

