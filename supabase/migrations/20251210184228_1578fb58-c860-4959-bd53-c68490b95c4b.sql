-- Drop existing restrictive policies on leads table
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can create their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;

-- Drop existing restrictive policies on interacoes table
DROP POLICY IF EXISTS "Users can view interacoes of their leads" ON public.interacoes;
DROP POLICY IF EXISTS "Users can create interacoes for their leads" ON public.interacoes;
DROP POLICY IF EXISTS "Users can update interacoes of their leads" ON public.interacoes;
DROP POLICY IF EXISTS "Users can delete interacoes of their leads" ON public.interacoes;

-- Create new policies for leads - authenticated users have full access
CREATE POLICY "Authenticated users can view all leads"
ON public.leads
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update all leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete all leads"
ON public.leads
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Create new policies for interacoes - authenticated users have full access
CREATE POLICY "Authenticated users can view all interacoes"
ON public.interacoes
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create interacoes"
ON public.interacoes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update all interacoes"
ON public.interacoes
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete all interacoes"
ON public.interacoes
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);