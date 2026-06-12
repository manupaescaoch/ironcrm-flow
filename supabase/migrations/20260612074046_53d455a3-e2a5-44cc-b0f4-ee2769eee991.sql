DROP POLICY IF EXISTS insert_gestao_metas_admin_coord_by_unidade ON public.gestao_metas;
DROP POLICY IF EXISTS update_gestao_metas_admin_coord_by_unidade ON public.gestao_metas;

CREATE POLICY insert_gestao_metas_by_unidade
ON public.gestao_metas
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY update_gestao_metas_by_unidade
ON public.gestao_metas
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

GRANT SELECT, INSERT, UPDATE ON public.gestao_metas TO authenticated;