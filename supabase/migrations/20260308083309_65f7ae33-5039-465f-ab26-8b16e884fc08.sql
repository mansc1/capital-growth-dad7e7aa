CREATE TABLE public.nav_backfill_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  requested_start_date date NOT NULL,
  requested_end_date date NOT NULL,
  reason text NOT NULL DEFAULT 'transaction_save',
  status text NOT NULL DEFAULT 'pending',
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_error text
);

CREATE UNIQUE INDEX uq_backfill_active_dedupe
  ON public.nav_backfill_queue (dedupe_key)
  WHERE status IN ('pending', 'processing');

ALTER TABLE public.nav_backfill_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.nav_backfill_queue FOR SELECT USING (true);
CREATE POLICY "Public write" ON public.nav_backfill_queue FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.nav_backfill_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();