CREATE POLICY update_nps_respostas_by_unidade ON public.nps_respostas
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IS NOT NULL AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IS NOT NULL AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
);