
DROP POLICY IF EXISTS "delete_rotinas_admin_coord" ON public.rotinas;

CREATE POLICY "delete_rotinas_admin_coord_comercial" ON public.rotinas
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordenador'::app_role)
  OR has_role(auth.uid(), 'user'::app_role)
);
