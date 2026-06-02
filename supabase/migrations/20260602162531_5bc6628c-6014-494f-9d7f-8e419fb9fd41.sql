-- Helper to validate that a storage object name in rotinas-comprovantes
-- corresponds to a real rotina/execução in a unidade the user can access.
--
-- Accepted path shapes (first folder must always be auth.uid()::text):
--   {uid}/{execucao_id}/...
--   {uid}/execucoes/{execucao_id}/...
--   {uid}/rotinas/{rotina_id}/...
--   {uid}/rotinas/{rotina_id}/execucoes/{execucao_id}/...
CREATE OR REPLACE FUNCTION public.user_can_insert_rotina_comprovante(
  _user_id uuid,
  _object_name text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parts text[];
  candidate text;
  v_uuid uuid;
  v_unidade uuid;
BEGIN
  IF _user_id IS NULL OR _object_name IS NULL THEN
    RETURN false;
  END IF;

  -- Admin always allowed
  IF public.has_role(_user_id, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  parts := string_to_array(_object_name, '/');
  IF array_length(parts, 1) < 2 THEN
    RETURN false;
  END IF;

  -- First folder must match user
  IF parts[1] IS DISTINCT FROM _user_id::text THEN
    RETURN false;
  END IF;

  -- Try to find a uuid segment that maps to an execução or rotina in a unidade
  -- the user has access to. Walk a few candidate positions.
  FOR i IN 2..LEAST(array_length(parts, 1), 6) LOOP
    candidate := parts[i];

    -- Skip non-uuid segments like 'rotinas', 'execucoes'
    BEGIN
      v_uuid := candidate::uuid;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;

    -- Check rotina_execucoes
    SELECT unidade_id INTO v_unidade
    FROM public.rotina_execucoes
    WHERE id = v_uuid;

    IF v_unidade IS NOT NULL THEN
      IF v_unidade IN (SELECT public.get_user_unidades(_user_id)) THEN
        RETURN true;
      ELSE
        RETURN false;
      END IF;
    END IF;

    -- Fallback: check rotinas
    SELECT unidade_id INTO v_unidade
    FROM public.rotinas
    WHERE id = v_uuid;

    IF v_unidade IS NOT NULL THEN
      IF v_unidade IN (SELECT public.get_user_unidades(_user_id)) THEN
        RETURN true;
      ELSE
        RETURN false;
      END IF;
    END IF;
  END LOOP;

  -- No valid rotina/execução reference found in the path
  RETURN false;
END;
$$;

-- Replace the broad INSERT policy with the stricter one
DROP POLICY IF EXISTS "rotinas_comprovantes_insert_own_folder" ON storage.objects;

CREATE POLICY "rotinas_comprovantes_insert_by_uploader_and_unidade"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rotinas-comprovantes'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.user_can_insert_rotina_comprovante(auth.uid(), name)
);