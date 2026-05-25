-- Drop old role-only policies on cronograma_atividades
DROP POLICY IF EXISTS "insert_cronograma_ativ_admin_comercial" ON public.cronograma_atividades;
DROP POLICY IF EXISTS "update_cronograma_ativ_admin_comercial" ON public.cronograma_atividades;
DROP POLICY IF EXISTS "delete_cronograma_ativ_admin_comercial" ON public.cronograma_atividades;

-- Ensure RLS is enabled
ALTER TABLE public.cronograma_atividades ENABLE ROW LEVEL SECURITY;

-- INSERT: admin OR (user/coordenador with unit access)
CREATE POLICY "insert_cronograma_ativ_by_unidade"
ON public.cronograma_atividades
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      (public.has_role(auth.uid(), 'user'::public.app_role)
        OR public.has_role(auth.uid(), 'coordenador'::public.app_role))
      AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
);

-- UPDATE: must satisfy on both current row (USING) and new row (WITH CHECK)
CREATE POLICY "update_cronograma_ativ_by_unidade"
ON public.cronograma_atividades
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      (public.has_role(auth.uid(), 'user'::public.app_role)
        OR public.has_role(auth.uid(), 'coordenador'::public.app_role))
      AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      (public.has_role(auth.uid(), 'user'::public.app_role)
        OR public.has_role(auth.uid(), 'coordenador'::public.app_role))
      AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
);

-- DELETE: admin OR (user/coordenador with unit access)
CREATE POLICY "delete_cronograma_ativ_by_unidade"
ON public.cronograma_atividades
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      (public.has_role(auth.uid(), 'user'::public.app_role)
        OR public.has_role(auth.uid(), 'coordenador'::public.app_role))
      AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
);