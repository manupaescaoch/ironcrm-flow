-- Allow users with unidade access to insert insumos
CREATE POLICY "insert_insumos_by_unidade" 
ON public.insumos 
FOR INSERT 
WITH CHECK (
  (auth.uid() IS NOT NULL) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR (unidade_id IN (SELECT get_user_unidades(auth.uid()))))
);

-- Allow users with unidade access to insert into estoque_interno
CREATE POLICY "insert_estoque_by_unidade" 
ON public.estoque_interno 
FOR INSERT 
WITH CHECK (
  (auth.uid() IS NOT NULL) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR (unidade_id IN (SELECT get_user_unidades(auth.uid()))))
);

-- Allow users with unidade access to update estoque_interno
CREATE POLICY "update_estoque_by_unidade" 
ON public.estoque_interno 
FOR UPDATE 
USING (
  (auth.uid() IS NOT NULL) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR (unidade_id IN (SELECT get_user_unidades(auth.uid()))))
)
WITH CHECK (
  (auth.uid() IS NOT NULL) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR (unidade_id IN (SELECT get_user_unidades(auth.uid()))))
);