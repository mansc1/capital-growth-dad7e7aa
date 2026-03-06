

# Update Cron Job Secret Header

## What
Update the existing `daily-nav-sync` pg_cron job to use the correct `x-cron-secret` header value matching the environment secret.

## How
Run via Supabase insert tool (not migration, since it contains project-specific data):

1. Unschedule the existing job
2. Re-create it with the correct secret value `navsync_9f7c21c4a6e94b3b8d9a2e5c6f7d1b0` in the `x-cron-secret` header

```sql
SELECT cron.unschedule('daily-nav-sync');

SELECT cron.schedule(
  'daily-nav-sync',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url:='https://wasgiapsgiagwwiwnfcl.supabase.co/functions/v1/sync-nav',
    headers:='{"Content-Type": "application/json", "x-cron-secret": "navsync_9f7c21c4a6e94b3b8d9a2e5c6f7d1b0"}'::jsonb,
    body:='{"trigger_type":"cron"}'::jsonb
  ) AS request_id;
  $$
);
```

No file changes needed.

