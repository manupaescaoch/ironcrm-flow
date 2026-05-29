-- Harden backup bucket storage policy: restrict to service_role only
DROP POLICY IF EXISTS "Service role can manage backup files" ON storage.objects;

CREATE POLICY "Service role can manage backup files"
ON storage.objects
FOR ALL
TO public
USING (
  bucket_id = 'backups_crm_iron'
  AND auth.role() = 'service_role'
)
WITH CHECK (
  bucket_id = 'backups_crm_iron'
  AND auth.role() = 'service_role'
);