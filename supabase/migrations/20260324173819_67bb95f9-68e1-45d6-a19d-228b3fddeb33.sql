
-- Drop existing insert/update/delete policies
DROP POLICY IF EXISTS "insert_rotinas_by_unidade" ON public.rotinas;
DROP POLICY IF EXISTS "update_rotinas_by_unidade" ON public.rotinas;
DROP POLICY IF EXISTS "delete_rotinas_admin_coord" ON public.rotinas;

-- Recreate with comercial (user role) included
CREATE POLICY "insert_rotinas_by_unidade" ON public.rotinas
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY "update_rotinas_by_unidade" ON public.rotinas
FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'user'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY "delete_rotinas_admin_coord" ON public.rotinas
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordenador'::app_role)
);
