-- Allow users with unidade access to update insumos
CREATE POLICY "update_insumos_by_unidade" 
ON public.insumos 
FOR UPDATE 
USING (
  (auth.uid() IS NOT NULL) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR (unidade_id IN (SELECT get_user_unidades(auth.uid()))))
)
WITH CHECK (
  (auth.uid() IS NOT NULL) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR (unidade_id IN (SELECT get_user_unidades(auth.uid()))))
);