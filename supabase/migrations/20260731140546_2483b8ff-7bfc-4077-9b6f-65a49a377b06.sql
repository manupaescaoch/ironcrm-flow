DROP POLICY IF EXISTS select_relatorio_diario_comercial_scoped ON public.relatorio_diario_comercial_respostas;

CREATE POLICY select_relatorio_diario_comercial_scoped
ON public.relatorio_diario_comercial_respostas
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      unidade_id IS NOT NULL
      AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
);