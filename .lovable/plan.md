

# Fix Manual NAV Sync Auth — Shared Secret Approach

## Changes

### 1. `supabase/functions/sync-nav/index.ts` (lines 28-59)

Replace the dual auth logic (cron secret vs JWT) with a single shared-secret check for all requests:

```typescript
// Auth: validate x-cron-secret for both cron and manual triggers
const cronSecretHeader = req.headers.get("x-cron-secret") ?? "";

if (!cronSecret || cronSecretHeader !== cronSecret) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

Remove the `authHeader`, `anonKey` variable, `createClient` user client, and `getClaims()` block entirely. The `anonKey` declaration on line 20 can also be removed since it's no longer used.

### 2. `src/hooks/use-nav-sync.ts`

Replace `supabase.functions.invoke()` with a direct `fetch()` call that sends the `x-cron-secret` header:

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const NAV_SYNC_SECRET = import.meta.env.VITE_NAV_SYNC_SECRET;

const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-nav`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-cron-secret": NAV_SYNC_SECRET,
  },
  body: JSON.stringify({ trigger_type: "manual" }),
});

if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
const result = await res.json() as SyncResult;
```

Remove the `supabase` import (no longer needed in this hook). Keep all cache invalidation and state management identical.

### 3. Environment variable

Add to `.env`:
```
VITE_NAV_SYNC_SECRET="navsync_9f7c21c4a6e94b3b8d9a2e5c6f7d1b0"
```

This is acceptable for a private single-user app. The value matches the server-side `NAV_SYNC_CRON_SECRET`.

### No other changes
Cron schedule, NAV provider logic, sync_runs table, snapshot rebuild, Settings UI, and Dashboard footer remain untouched.

