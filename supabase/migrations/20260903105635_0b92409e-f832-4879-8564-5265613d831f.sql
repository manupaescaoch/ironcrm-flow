CREATE OR REPLACE FUNCTION public.ops_evidencia_atividade_id(_object_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  seg text := split_part(_object_name, '/', 1);
BEGIN
  IF seg ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN seg::uuid;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.ops_evidencia_atividade_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_evidencia_atividade_id(text) TO authenticated, service_role;

CREATE POLICY "ops_evidencias_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'ops-evidencias'
  AND public.ops_evidencia_atividade_id(name) IS NOT NULL
  AND public.ops_can_access_atividade(auth.uid(), public.ops_evidencia_atividade_id(name))
);

CREATE POLICY "ops_evidencias_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ops-evidencias'
  AND public.ops_evidencia_atividade_id(name) IS NOT NULL
  AND public.ops_can_execute_atividade(auth.uid(), public.ops_evidencia_atividade_id(name))
);

CREATE POLICY "ops_evidencias_delete_admin" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'ops-evidencias'
  AND public.has_role(auth.uid(), 'admin')
);