UPDATE public.funds
SET is_active = false, updated_at = now()
WHERE is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t WHERE t.fund_id = funds.id
  );