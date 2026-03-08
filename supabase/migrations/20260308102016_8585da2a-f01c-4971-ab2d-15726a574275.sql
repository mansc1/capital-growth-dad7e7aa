
-- Clean up failed backfill queue jobs (targeted: preserve completed/pending history)
DELETE FROM nav_backfill_queue WHERE status = 'failed';

-- Reset stuck processing jobs (older than 10 minutes) back to pending
DO $$
DECLARE
  reset_count integer;
BEGIN
  UPDATE nav_backfill_queue
  SET status = 'pending', updated_at = now()
  WHERE status = 'processing'
    AND updated_at < now() - interval '10 minutes';
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RAISE NOTICE 'Reset % stuck processing jobs back to pending', reset_count;
END $$;
