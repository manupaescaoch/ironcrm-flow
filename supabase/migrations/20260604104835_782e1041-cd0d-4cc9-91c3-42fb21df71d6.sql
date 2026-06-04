-- 1. Add new columns
ALTER TABLE public.relatorio_diario_comercial_respostas
ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id),
ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id);

-- 2. Populate unidade_id from existing unidade text
UPDATE public.relatorio_diario_comercial_respostas
SET unidade_id = 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6'
WHERE unidade = 'ZONA NORTE';

UPDATE public.relatorio_diario_comercial_respostas
SET unidade_id = 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a'
WHERE unidade = 'ZONA SUL';

-- 3. Drop old policies
DROP POLICY IF EXISTS "insert_relatorio_diario_comercial_public" ON public.relatorio_diario_comercial_respostas;
DROP POLICY IF EXISTS "insert_relatorio_diario_authenticated" ON public.relatorio_diario_comercial_respostas;
DROP POLICY IF EXISTS "Admins can view relatorio diario" ON public.relatorio_diario_comercial_respostas;
DROP POLICY IF EXISTS "Admins can update relatorio diario" ON public.relatorio_diario_comercial_respostas;
DROP POLICY IF EXISTS "Admins can delete relatorio diario" ON public.relatorio_diario_comercial_respostas;

-- 4. Enable RLS (just in case)
ALTER TABLE public.relatorio_diario_comercial_respostas ENABLE ROW LEVEL SECURITY;

-- 5. Create new policies

-- SELECT: Admins can see all, users/coordinators see their unit's reports
CREATE POLICY "select_relatorio_diario_comercial_scoped"
ON public.relatorio_diario_comercial_respostas
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator') -- coordinator might be mapped to moderator or coordinator role
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'coordenador'
    )
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

-- INSERT: Authenticated users can insert for their own units
CREATE POLICY "insert_relatorio_diario_comercial_scoped"
ON public.relatorio_diario_comercial_respostas
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (submitted_by IS NULL OR submitted_by = auth.uid()) -- allow null for now or force auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

-- UPDATE: Only admins
CREATE POLICY "update_relatorio_diario_comercial_admin"
ON public.relatorio_diario_comercial_respostas
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- DELETE: Only admins
CREATE POLICY "delete_relatorio_diario_comercial_admin"
ON public.relatorio_diario_comercial_respostas
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 6. Grants
GRANT SELECT, INSERT ON public.relatorio_diario_comercial_respostas TO authenticated;
GRANT ALL ON public.relatorio_diario_comercial_respostas TO service_role;
