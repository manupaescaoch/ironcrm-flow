
-- Drop existing policies
DROP POLICY IF EXISTS "insert_escala_admin_coord_comercial" ON public.escala;
DROP POLICY IF EXISTS "update_escala_admin_coord_comercial" ON public.escala;
DROP POLICY IF EXISTS "delete_escala_admin_coord_comercial" ON public.escala;

-- Allow any authenticated user to insert
CREATE POLICY "insert_escala_any_authenticated" ON public.escala
FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow any authenticated user to update
CREATE POLICY "update_escala_any_authenticated" ON public.escala
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- Allow any authenticated user to delete
CREATE POLICY "delete_escala_any_authenticated" ON public.escala
FOR DELETE TO authenticated
USING (true);
