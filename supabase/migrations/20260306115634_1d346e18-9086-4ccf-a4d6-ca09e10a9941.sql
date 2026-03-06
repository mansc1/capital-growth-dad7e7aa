
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.sec_fund_directory (
  proj_id text PRIMARY KEY,
  proj_abbr_name text NOT NULL,
  proj_name_en text,
  proj_name_th text,
  amc_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sec_fund_directory_abbr ON public.sec_fund_directory (proj_abbr_name);
CREATE INDEX idx_sec_fund_directory_name_en ON public.sec_fund_directory USING gin (proj_name_en gin_trgm_ops);
CREATE INDEX idx_sec_fund_directory_abbr_trgm ON public.sec_fund_directory USING gin (proj_abbr_name gin_trgm_ops);

ALTER TABLE public.sec_fund_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.sec_fund_directory FOR SELECT USING (true);
CREATE POLICY "Service role write access" ON public.sec_fund_directory FOR ALL USING (true) WITH CHECK (true);
