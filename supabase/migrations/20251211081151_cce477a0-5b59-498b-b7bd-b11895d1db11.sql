-- Create storage bucket for CRM backups
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backups_crm_iron', 
  'backups_crm_iron', 
  false,
  52428800, -- 50MB limit
  ARRAY['text/csv', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for backups bucket - only admins can access
CREATE POLICY "Admins can view backup files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'backups_crm_iron' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can upload backup files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'backups_crm_iron' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete backup files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'backups_crm_iron' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Service role policy for edge functions (using service role key)
CREATE POLICY "Service role can manage backup files"
ON storage.objects
FOR ALL
USING (bucket_id = 'backups_crm_iron')
WITH CHECK (bucket_id = 'backups_crm_iron');