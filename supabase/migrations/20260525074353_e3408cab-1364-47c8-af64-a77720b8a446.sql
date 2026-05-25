
-- 1. Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'rotinas-comprovantes';

-- 2. Drop overly-permissive policies
DROP POLICY IF EXISTS "Anyone can view rotinas photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload rotinas photos" ON storage.objects;

-- 3. Scoped SELECT: only admin or coordenador roles
CREATE POLICY "rotinas_comprovantes_select_staff"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rotinas-comprovantes'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'coordenador'::public.app_role)
  )
);

-- 4. INSERT: authenticated users only, file path must start with their user_id folder
CREATE POLICY "rotinas_comprovantes_insert_own_folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rotinas-comprovantes'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. UPDATE: only admin
CREATE POLICY "rotinas_comprovantes_update_admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'rotinas-comprovantes'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 6. DELETE: only admin
CREATE POLICY "rotinas_comprovantes_delete_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'rotinas-comprovantes'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
