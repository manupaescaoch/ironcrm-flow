
-- Restrict telefone column on cronograma_funcionarios
-- Strategy: keep row-level SELECT for unit members (joins still resolve nome),
-- but remove telefone from column-level grants to authenticated.
-- Admin/coordenador read full record (incl. telefone) via SECURITY DEFINER RPC.

REVOKE SELECT ON public.cronograma_funcionarios FROM authenticated;
REVOKE SELECT ON public.cronograma_funcionarios FROM anon;

GRANT SELECT (id, unidade_id, nome, setor, turno, cargo, ativo, created_at, updated_at)
  ON public.cronograma_funcionarios TO authenticated;

-- Ensure write privileges remain (RLS still enforces admin-only writes)
GRANT INSERT, UPDATE, DELETE ON public.cronograma_funcionarios TO authenticated;
GRANT ALL ON public.cronograma_funcionarios TO service_role;

-- RPC for admin/coordenador to fetch full records including telefone
CREATE OR REPLACE FUNCTION public.get_cronograma_funcionarios_full(p_unidade_id uuid)
RETURNS SETOF public.cronograma_funcionarios
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'coordenador'::public.app_role)
      AND public.user_has_unidade_access(auth.uid(), p_unidade_id)
    )
  ) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  RETURN QUERY
    SELECT * FROM public.cronograma_funcionarios
    WHERE unidade_id = p_unidade_id
    ORDER BY nome;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cronograma_funcionarios_full(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cronograma_funcionarios_full(uuid) TO authenticated;
