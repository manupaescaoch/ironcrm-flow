-- Drop redundant UPDATE policy on leads (the ownership-based one already exists)
DROP POLICY IF EXISTS "Authenticated users can update all leads" ON public.leads;

-- Drop overly permissive DELETE policy and create ownership-based one
DROP POLICY IF EXISTS "Authenticated users can delete all leads" ON public.leads;

CREATE POLICY "delete_own_leads_or_admin" ON public.leads
FOR DELETE USING (
  created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix interacoes table: add created_by column and ownership-based policies
ALTER TABLE public.interacoes ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

-- Drop overly permissive policies on interacoes
DROP POLICY IF EXISTS "Authenticated users can update all interacoes" ON public.interacoes;
DROP POLICY IF EXISTS "Authenticated users can delete all interacoes" ON public.interacoes;

-- Create ownership-based policies for interacoes
CREATE POLICY "update_own_interacoes_or_admin" ON public.interacoes
FOR UPDATE USING (
  created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "delete_own_interacoes_or_admin" ON public.interacoes
FOR DELETE USING (
  created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);