ALTER TABLE public.sync_runs ADD COLUMN provider text NOT NULL DEFAULT 'mock';
UPDATE public.sync_runs SET provider = 'mock' WHERE provider IS NULL;