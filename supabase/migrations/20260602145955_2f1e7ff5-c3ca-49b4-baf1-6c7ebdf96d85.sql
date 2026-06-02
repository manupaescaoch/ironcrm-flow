-- Adiciona SELECT policy para que o próprio uploader leia seus comprovantes de rotina
CREATE POLICY "rotinas_comprovantes_select_own_uploads"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rotinas-comprovantes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Adiciona DELETE policy para que o próprio uploader exclua seus comprovantes de rotina
CREATE POLICY "rotinas_comprovantes_delete_own_uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'rotinas-comprovantes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);