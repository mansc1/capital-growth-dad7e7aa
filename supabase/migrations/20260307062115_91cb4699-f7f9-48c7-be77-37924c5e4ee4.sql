CREATE POLICY "Anon read access"
ON public.sync_runs
FOR SELECT
TO anon
USING (true);