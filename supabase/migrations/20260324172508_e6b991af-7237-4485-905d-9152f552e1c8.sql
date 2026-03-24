
-- Atualizar política de INSERT para permitir comercial (user) e admin
DROP POLICY IF EXISTS "insert_cronograma_ativ_admin" ON public.cronograma_atividades;
CREATE POLICY "insert_cronograma_ativ_admin_comercial" ON public.cronograma_atividades
FOR INSERT
WITH CHECK (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  )
);

-- Atualizar política de UPDATE para permitir comercial (user) e admin
DROP POLICY IF EXISTS "update_cronograma_ativ_admin" ON public.cronograma_atividades;
CREATE POLICY "update_cronograma_ativ_admin_comercial" ON public.cronograma_atividades
FOR UPDATE
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  )
);

-- Atualizar política de DELETE para permitir comercial (user) e admin
DROP POLICY IF EXISTS "delete_cronograma_ativ_admin" ON public.cronograma_atividades;
CREATE POLICY "delete_cronograma_ativ_admin_comercial" ON public.cronograma_atividades
FOR DELETE
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'user'::app_role)
  )
);
