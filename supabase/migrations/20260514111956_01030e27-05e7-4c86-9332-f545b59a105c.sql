DROP POLICY IF EXISTS "insert_escala_any_authenticated" ON public.escala;
DROP POLICY IF EXISTS "update_escala_any_authenticated" ON public.escala;
DROP POLICY IF EXISTS "delete_escala_any_authenticated" ON public.escala;

CREATE POLICY "insert_escala_by_unidade"
ON public.escala
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_has_unidade_access(auth.uid(), unidade_id)
  )
);

CREATE POLICY "update_escala_by_unidade"
ON public.escala
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_has_unidade_access(auth.uid(), unidade_id)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_has_unidade_access(auth.uid(), unidade_id)
  )
);

CREATE POLICY "delete_escala_by_unidade"
ON public.escala
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.user_has_unidade_access(auth.uid(), unidade_id)
  )
);