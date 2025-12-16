-- Drop existing restrictive policies on interacoes
DROP POLICY IF EXISTS "Authenticated users can view all interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "Authenticated users can create interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "update_own_interacoes_or_admin" ON public.interacoes;
DROP POLICY IF EXISTS "delete_own_interacoes_or_admin" ON public.interacoes;

-- Recreate as PERMISSIVE policies (default behavior)
CREATE POLICY "Authenticated users can view all interacoes" 
ON public.interacoes 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create interacoes" 
ON public.interacoes 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "update_own_interacoes_or_admin" 
ON public.interacoes 
FOR UPDATE 
TO authenticated
USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "delete_own_interacoes_or_admin" 
ON public.interacoes 
FOR DELETE 
TO authenticated
USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Drop existing restrictive policies on leads
DROP POLICY IF EXISTS "select_all_leads_for_authenticated" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can create leads" ON public.leads;
DROP POLICY IF EXISTS "update_own_leads_or_admin" ON public.leads;
DROP POLICY IF EXISTS "delete_own_leads_or_admin" ON public.leads;

-- Recreate as PERMISSIVE policies
CREATE POLICY "select_all_leads_for_authenticated" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create leads" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "update_own_leads_or_admin" 
ON public.leads 
FOR UPDATE 
TO authenticated
USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "delete_own_leads_or_admin" 
ON public.leads 
FOR DELETE 
TO authenticated
USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));