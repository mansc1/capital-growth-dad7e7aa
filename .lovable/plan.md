

# Fix: Empty-portfolio sync runs not displaying in Settings

## Root Cause

The `sync-nav` edge function correctly creates and completes a `sync_runs` row for empty-portfolio syncs. The problem is on the **read side**: the `sync_runs` table only has an "Authenticated read access" SELECT policy, but the app uses the **anon** role (no auth). The client query returns empty results, so the Settings card shows "No syncs yet."

## Changes

### 1. Database Migration — Add anon read policy to `sync_runs`

**New migration** adding an anon SELECT policy to match the pattern used by `funds`, `nav_history`, and other tables:

```sql
CREATE POLICY "Anon read access"
ON public.sync_runs
FOR SELECT
TO anon
USING (true);
```

This is the only change needed. The edge function already persists sync_runs correctly for empty portfolios, and the Settings UI already reads from `useLastSuccessfulSync()` which queries sync_runs. Once the anon role can read the table, all fields (provider, status, completed_at) will display correctly.

### Files Changed

| File | Action |
|------|--------|
| `supabase/migrations/[timestamp]_add_anon_read_sync_runs.sql` | New — add anon SELECT policy |

