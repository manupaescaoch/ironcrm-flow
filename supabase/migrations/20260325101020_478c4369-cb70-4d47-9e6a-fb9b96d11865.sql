DROP POLICY IF EXISTS "Users can view own unidades" ON public.user_unidades;

CREATE POLICY "Users can view unidade members" ON public.user_unidades
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);