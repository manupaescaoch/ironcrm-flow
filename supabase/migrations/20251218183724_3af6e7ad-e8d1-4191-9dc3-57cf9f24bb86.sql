-- Política DELETE para insumos (soft delete via UPDATE já funciona, mas adiciona DELETE real)
CREATE POLICY "delete_insumos_by_unidade" 
ON public.insumos 
FOR DELETE 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

-- Política DELETE para estoque_interno
CREATE POLICY "delete_estoque_by_unidade" 
ON public.estoque_interno 
FOR DELETE 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

-- Política DELETE para movimentacoes_estoque
CREATE POLICY "delete_movimentacoes_by_unidade" 
ON public.movimentacoes_estoque 
FOR DELETE 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);