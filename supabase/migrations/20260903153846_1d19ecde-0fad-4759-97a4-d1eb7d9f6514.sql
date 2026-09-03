-- Setores do usuário (via vínculo de funcionário)
CREATE OR REPLACE FUNCTION public.ops_setores_do_usuario(_user_id uuid)
RETURNS TABLE(setor text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT upper(btrim(f.setor))
  FROM public.cronograma_funcionarios f
  WHERE f.user_id = _user_id
    AND f.ativo = true
    AND f.setor IS NOT NULL
    AND btrim(f.setor) <> '';
$$;

REVOKE ALL ON FUNCTION public.ops_setores_do_usuario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_setores_do_usuario(uuid) TO authenticated, service_role;

-- Papel de gestão: checa diretamente user_roles (gerente herda via has_role, por isso a checagem direta)
CREATE OR REPLACE FUNCTION public.ops_is_gestao(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = _user_id
      AND r.role IN ('admin','coordenador','gerente','moderator')
  );
$$;

REVOKE ALL ON FUNCTION public.ops_is_gestao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_is_gestao(uuid) TO authenticated, service_role;

-- Regra central de visibilidade de atividade
CREATE OR REPLACE FUNCTION public.ops_can_access_atividade(_user_id uuid, _atividade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin') OR EXISTS (
      SELECT 1 FROM public.cronograma_atividades a
      WHERE a.id = _atividade_id
        AND a.unidade_id IN (SELECT public.get_user_unidades(_user_id))
        AND (
          public.ops_is_gestao(_user_id)
          -- sem vínculo/setor cadastrado: mantém visão da unidade
          OR NOT EXISTS (SELECT 1 FROM public.ops_setores_do_usuario(_user_id))
          OR a.setor IS NULL OR btrim(a.setor) = ''
          OR upper(btrim(a.setor)) IN (SELECT s FROM public.ops_setores_do_usuario(_user_id) s)
          OR EXISTS (
            SELECT 1 FROM public.cronograma_funcionarios f
            WHERE f.id = a.responsavel_id AND f.user_id = _user_id
          )
          OR a.criado_por = _user_id
        )
    )
  );
$$;

-- SELECT em cronograma_atividades passa a usar a mesma regra
DROP POLICY IF EXISTS select_cronograma_ativ_by_unidade ON public.cronograma_atividades;
CREATE POLICY select_cronograma_ativ_by_unidade
ON public.cronograma_atividades
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin') OR (
      unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
      AND (
        public.ops_is_gestao(auth.uid())
        OR NOT EXISTS (SELECT 1 FROM public.ops_setores_do_usuario(auth.uid()))
        OR setor IS NULL OR btrim(setor) = ''
        OR upper(btrim(setor)) IN (SELECT s FROM public.ops_setores_do_usuario(auth.uid()) s)
        OR EXISTS (
          SELECT 1 FROM public.cronograma_funcionarios f
          WHERE f.id = responsavel_id AND f.user_id = auth.uid()
        )
        OR criado_por = auth.uid()
      )
    )
  )
);