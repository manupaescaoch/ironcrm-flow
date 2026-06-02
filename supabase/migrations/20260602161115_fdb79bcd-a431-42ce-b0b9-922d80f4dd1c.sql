
-- 1. Helper: valida acesso ao anexo via reuniao_id extraído do path
CREATE OR REPLACE FUNCTION public.user_can_access_reuniao_anexo(_user_id uuid, _object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reuniao_id uuid;
  v_unidade_id uuid;
BEGIN
  IF _user_id IS NULL OR _object_name IS NULL THEN
    RETURN false;
  END IF;

  -- Path esperado: {reuniao_id}/{timestamp}_{filename}
  BEGIN
    v_reuniao_id := split_part(_object_name, '/', 1)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  SELECT unidade_id INTO v_unidade_id
  FROM public.reunioes
  WHERE id = v_reuniao_id;

  IF v_unidade_id IS NULL THEN
    RETURN false;
  END IF;

  -- Admin acessa tudo; demais precisam ter vínculo com a unidade
  IF public.has_role(_user_id, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  RETURN public.user_has_unidade_access(_user_id, v_unidade_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_access_reuniao_anexo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_reuniao_anexo(uuid, text) TO authenticated, service_role;

-- 2. Drop policies antigas do bucket reuniao-anexos
DROP POLICY IF EXISTS "Reuniao anexos: upload autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Reuniao anexos: leitura autenticada" ON storage.objects;
DROP POLICY IF EXISTS "Reuniao anexos: delete por autor/admin" ON storage.objects;

-- 3. SELECT escopado por unidade
CREATE POLICY "reuniao_anexos_select_by_unidade"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reuniao-anexos'
  AND public.user_can_access_reuniao_anexo(auth.uid(), name)
);

-- 4. INSERT escopado por unidade (sem mais "qualquer authenticated")
CREATE POLICY "reuniao_anexos_insert_by_unidade"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reuniao-anexos'
  AND public.user_can_access_reuniao_anexo(auth.uid(), name)
);

-- 5. UPDATE: anexos são imutáveis; só admin pode sobrescrever (policy explícita fecha o gap do linter)
CREATE POLICY "reuniao_anexos_update_admin_only"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'reuniao-anexos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'reuniao-anexos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 6. DELETE: admin/coordenador da unidade, ou autor do upload com acesso à unidade
CREATE POLICY "reuniao_anexos_delete_by_unidade"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'reuniao-anexos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.user_can_access_reuniao_anexo(auth.uid(), name)
      AND (
        public.has_role(auth.uid(), 'coordenador'::public.app_role)
        OR owner = auth.uid()
      )
    )
  )
);

COMMENT ON FUNCTION public.user_can_access_reuniao_anexo(uuid, text) IS
  'Valida se o usuário pode acessar um objeto do bucket reuniao-anexos. Extrai reuniao_id do path (formato: {reuniao_id}/...), busca unidade_id em public.reunioes e checa admin OR user_has_unidade_access. SECURITY DEFINER para ler reunioes sem expor RLS ao chamador.';
