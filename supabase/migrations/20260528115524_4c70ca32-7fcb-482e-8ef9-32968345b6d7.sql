-- Remove policy ampla e cria SELECT escopado por unidade na tabela insumos
DROP POLICY IF EXISTS "Authenticated can view insumos" ON public.insumos;

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_insumos_by_unidade"
ON public.insumos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
);