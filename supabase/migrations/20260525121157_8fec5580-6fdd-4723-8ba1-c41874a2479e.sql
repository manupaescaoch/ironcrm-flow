-- Drop existing policies on public.rotinas to recreate with correct unit scope
DROP POLICY IF EXISTS "delete_rotinas_admin_coord_comercial" ON public.rotinas;
DROP POLICY IF EXISTS "insert_rotinas_by_unidade" ON public.rotinas;
DROP POLICY IF EXISTS "update_rotinas_by_unidade" ON public.rotinas;
DROP POLICY IF EXISTS "select_rotinas_by_unidade" ON public.rotinas;

-- Enable RLS (idempotent)
ALTER TABLE public.rotinas ENABLE ROW LEVEL SECURITY;

-- SELECT: admin sees all; non-admin only their units
CREATE POLICY "select_rotinas_by_unidade"
ON public.rotinas
FOR SELECT
TO public
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);

-- INSERT: admin can insert anywhere; non-admin must have role AND unit in scope
CREATE POLICY "insert_rotinas_by_unidade"
ON public.rotinas
FOR INSERT
TO public
WITH CHECK (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      (has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'user'::app_role))
      AND (unidade_id IN (SELECT get_user_unidades(auth.uid())))
    )
  )
);

-- UPDATE: admin can update any; non-admin must have role AND unit in scope for both old and new row
CREATE POLICY "update_rotinas_by_unidade"
ON public.rotinas
FOR UPDATE
TO public
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      (has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'user'::app_role))
      AND (unidade_id IN (SELECT get_user_unidades(auth.uid())))
    )
  )
)
WITH CHECK (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      (has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'user'::app_role))
      AND (unidade_id IN (SELECT get_user_unidades(auth.uid())))
    )
  )
);

-- DELETE: admin can delete any; non-admin must have role AND unit in scope
CREATE POLICY "delete_rotinas_admin_coord_comercial"
ON public.rotinas
FOR DELETE
TO public
USING (
  (auth.uid() IS NOT NULL) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      (has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'user'::app_role))
      AND (unidade_id IN (SELECT get_user_unidades(auth.uid())))
    )
  )
);