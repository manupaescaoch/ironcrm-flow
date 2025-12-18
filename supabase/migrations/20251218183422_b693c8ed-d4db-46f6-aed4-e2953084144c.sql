-- Remover políticas restritivas existentes
DROP POLICY IF EXISTS "update_insumos_by_unidade" ON public.insumos;
DROP POLICY IF EXISTS "insert_insumos_by_unidade" ON public.insumos;
DROP POLICY IF EXISTS "insert_estoque_by_unidade" ON public.estoque_interno;
DROP POLICY IF EXISTS "update_estoque_by_unidade" ON public.estoque_interno;

-- Criar políticas PERMISSIVAS para insumos (INSERT)
CREATE POLICY "insert_insumos_by_unidade" 
ON public.insumos 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

-- Criar políticas PERMISSIVAS para insumos (UPDATE)
CREATE POLICY "update_insumos_by_unidade" 
ON public.insumos 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

-- Criar políticas PERMISSIVAS para estoque_interno (INSERT)
CREATE POLICY "insert_estoque_by_unidade" 
ON public.estoque_interno 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

-- Criar políticas PERMISSIVAS para estoque_interno (UPDATE)
CREATE POLICY "update_estoque_by_unidade" 
ON public.estoque_interno 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);