-- Drop existing select policy if exists
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON public.leads;

-- Todo usuário autenticado pode ENXERGAR todos os leads
CREATE POLICY "select_all_leads_for_authenticated"
ON public.leads
FOR SELECT
USING (auth.uid() IS NOT NULL);