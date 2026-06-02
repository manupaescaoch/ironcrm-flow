ALTER TABLE public.gestao_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_gestao_metas_by_unidade"
ON public.gestao_metas
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR unidade_id IN (
    SELECT public.get_user_unidades(auth.uid())
  )
);