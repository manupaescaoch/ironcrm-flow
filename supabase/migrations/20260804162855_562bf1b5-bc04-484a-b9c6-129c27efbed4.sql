CREATE OR REPLACE FUNCTION public.user_can_access_conta_pagar_doc(_user_id uuid, _object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_unidade uuid;
BEGIN
  IF _user_id IS NULL OR _object_name IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(_user_id, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  BEGIN
    v_unidade := split_part(_object_name, '/', 1)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  RETURN v_unidade IN (SELECT public.get_user_unidades(_user_id));
END;
$$;

CREATE POLICY contas_pagar_docs_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'contas-pagar-docs'
  AND public.user_can_access_conta_pagar_doc(auth.uid(), name)
);

CREATE POLICY contas_pagar_docs_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contas-pagar-docs'
  AND public.user_can_access_conta_pagar_doc(auth.uid(), name)
);

CREATE POLICY contas_pagar_docs_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'contas-pagar-docs'
  AND public.can_manage_contas_pagar(auth.uid())
  AND public.user_can_access_conta_pagar_doc(auth.uid(), name)
)
WITH CHECK (
  bucket_id = 'contas-pagar-docs'
  AND public.can_manage_contas_pagar(auth.uid())
  AND public.user_can_access_conta_pagar_doc(auth.uid(), name)
);

CREATE POLICY contas_pagar_docs_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'contas-pagar-docs'
  AND public.can_manage_contas_pagar(auth.uid())
  AND public.user_can_access_conta_pagar_doc(auth.uid(), name)
);