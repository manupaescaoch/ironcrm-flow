-- 1. Create a helper function for scoped staff access
CREATE OR REPLACE FUNCTION public.user_can_access_rotina_comprovante_by_unidade(_user_id uuid, _object_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- We need at least two segments (uploader/uuid or uploader/type/uuid)
  IF array_length(parts, 1) < 2 THEN
    RETURN false;
  END IF;

  -- Walk through path segments to find a valid UUID (execution_id or rotina_id)
  -- Formats: {uid}/{execucao_id}/... OR {uid}/rotinas/{rotina_id}/... etc.
  FOR i IN 1..LEAST(array_length(parts, 1), 6) LOOP
    candidate := parts[i];

    -- Try to cast to UUID
    BEGIN
      v_uuid := candidate::uuid;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;

    -- Check if it belongs to an execution
    SELECT unidade_id INTO v_unidade
    FROM public.rotina_execucoes
    WHERE id = v_uuid;

    IF v_unidade IS NOT NULL THEN
      RETURN v_unidade IN (SELECT public.get_user_unidades(_user_id));
    END IF;

    -- Check if it belongs to a routine
    SELECT unidade_id INTO v_unidade
    FROM public.rotinas
    WHERE id = v_uuid;

    IF v_unidade IS NOT NULL THEN
      RETURN v_unidade IN (SELECT public.get_user_unidades(_user_id));
    END IF;
  END LOOP;

  -- No valid rotina/execução reference found in the path or no access to that unit
  RETURN false;
END;
$function$;

-- Revoke execute from public and grant to authenticated
REVOKE ALL ON FUNCTION public.user_can_access_rotina_comprovante_by_unidade(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.user_can_access_rotina_comprovante_by_unidade(uuid, text) TO authenticated;
GRANT ALL ON FUNCTION public.user_can_access_rotina_comprovante_by_unidade(uuid, text) TO service_role;

-- 2. Drop the broad staff SELECT policy
DROP POLICY IF EXISTS "rotinas_comprovantes_select_staff" ON storage.objects;

-- 3. Create the scoped staff SELECT policy
CREATE POLICY "rotinas_comprovantes_select_staff_by_unidade"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rotinas-comprovantes'
  AND auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'coordenador')
      AND public.user_can_access_rotina_comprovante_by_unidade(auth.uid(), name)
    )
  )
);

-- 4. Secure DELETE for staff
DROP POLICY IF EXISTS "rotinas_comprovantes_delete_staff" ON storage.objects;

CREATE POLICY "rotinas_comprovantes_delete_staff_by_unidade"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'rotinas-comprovantes'
  AND auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'coordenador')
      AND public.user_can_access_rotina_comprovante_by_unidade(auth.uid(), name)
    )
  )
);
