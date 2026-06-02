ALTER TABLE public.gestao_lancamentos_semanais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_gestao_lancamentos_semanais_by_unidade"
ON public.gestao_lancamentos_semanais
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
);