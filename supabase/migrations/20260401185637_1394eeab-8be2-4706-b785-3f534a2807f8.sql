
-- Drop existing INSERT/UPDATE/DELETE policies on escala
DROP POLICY IF EXISTS "insert_escala_admin_coord" ON public.escala;
DROP POLICY IF EXISTS "update_escala_admin_coord" ON public.escala;
DROP POLICY IF EXISTS "delete_escala_admin_coord" ON public.escala;

-- Recreate with comercial (user) role included, restricted by unidade
CREATE POLICY "insert_escala_admin_coord_comercial" ON public.escala
FOR INSERT TO public
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
    OR (has_role(auth.uid(), 'user'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);

CREATE POLICY "update_escala_admin_coord_comercial" ON public.escala
FOR UPDATE TO public
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
    OR (has_role(auth.uid(), 'user'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
    OR (has_role(auth.uid(), 'user'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);

CREATE POLICY "delete_escala_admin_coord_comercial" ON public.escala
FOR DELETE TO public
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
    OR (has_role(auth.uid(), 'user'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);
