
-- Create enums
CREATE TYPE public.tx_type AS ENUM ('buy', 'sell', 'dividend', 'switch_in', 'switch_out');
CREATE TYPE public.dividend_type AS ENUM ('cash', 'reinvest');

-- Create funds table
CREATE TABLE public.funds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fund_code TEXT NOT NULL UNIQUE,
  fund_name TEXT NOT NULL,
  amc_name TEXT NOT NULL,
  category TEXT,
  asset_class TEXT,
  risk_level INTEGER CHECK (risk_level >= 1 AND risk_level <= 8),
  currency TEXT NOT NULL DEFAULT 'THB',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  tx_type public.tx_type NOT NULL,
  trade_date DATE NOT NULL,
  units NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  nav_at_trade NUMERIC NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  dividend_type public.dividend_type,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create nav_history table
CREATE TABLE public.nav_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  nav_date DATE NOT NULL,
  nav_per_unit NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  source TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(fund_id, nav_date)
);

-- Create portfolio_snapshots table
CREATE TABLE public.portfolio_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  total_value NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  total_gain_loss NUMERIC NOT NULL,
  total_return_percent NUMERIC NOT NULL,
  latest_nav_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Simple single-user RLS: authenticated users get full CRUD
CREATE POLICY "Authenticated users full access" ON public.funds FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.nav_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.portfolio_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also allow anon read for simplicity in single-user app (no auth required initially)
CREATE POLICY "Anon read access" ON public.funds FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read access" ON public.transactions FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read access" ON public.nav_history FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read access" ON public.portfolio_snapshots FOR SELECT TO anon USING (true);
CREATE POLICY "Anon write access" ON public.funds FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon write access" ON public.transactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon write access" ON public.nav_history FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon write access" ON public.portfolio_snapshots FOR ALL TO anon USING (true) WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers
CREATE TRIGGER update_funds_updated_at BEFORE UPDATE ON public.funds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_nav_history_updated_at BEFORE UPDATE ON public.nav_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_transactions_fund_id ON public.transactions(fund_id);
CREATE INDEX idx_transactions_trade_date ON public.transactions(trade_date);
CREATE INDEX idx_nav_history_fund_id ON public.nav_history(fund_id);
CREATE INDEX idx_nav_history_nav_date ON public.nav_history(nav_date);
CREATE INDEX idx_portfolio_snapshots_date ON public.portfolio_snapshots(snapshot_date);
