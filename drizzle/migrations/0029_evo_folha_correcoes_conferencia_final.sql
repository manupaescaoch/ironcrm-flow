-- Helpers de permissão: o chamador só consulta a si mesmo, salvo admin, service_role ou execução interna sem JWT.
CREATE OR REPLACE FUNCTION public.folha_chamador_pode_consultar(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$ SELECT current_setting('request.jwt.claims', true) IS NULL
   OR coalesce(current_setting('request.jwt.claims', true),'') = ''
   OR coalesce(auth.role(),'') = 'service_role'
   OR (auth.uid() IS NOT NULL AND (_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))) $$;
REVOKE ALL ON FUNCTION public.folha_chamador_pode_consultar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.folha_chamador_pode_consultar(uuid) TO service_role;

-- Regras globais: somente administrador (gerente nunca, mesmo com permissão gravada).
CREATE OR REPLACE FUNCTION public.folha_pode_global(_user_id uuid, _acao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
  SELECT _user_id IS NOT NULL AND public.folha_chamador_pode_consultar(_user_id) AND (
    public.has_role(_user_id,'admin'::public.app_role)
    OR (_acao <> 'regras'
        AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='gerente'::public.app_role)
        AND EXISTS (SELECT 1 FROM public.folha_permissoes WHERE user_id=_user_id AND acao=_acao)))
$$;
CREATE OR REPLACE FUNCTION public.folha_pode(_user_id uuid, _unidade_id uuid, _acao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$ SELECT public.folha_chamador_pode_consultar(_user_id) AND public.folha_pode_acessar(_user_id,_unidade_id) AND public.folha_pode_global(_user_id,_acao) $$;
REVOKE ALL ON FUNCTION public.folha_pode(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.folha_pode_global(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.folha_pode(uuid,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.folha_pode_global(uuid,text) TO authenticated, service_role;

DROP POLICY IF EXISTS folha_config_upd ON public.folha_config;
CREATE POLICY folha_config_upd ON public.folha_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

-- Upload: somente no caminho exato de uma tentativa própria, pendente, da mesma unidade/competência, sem documento vinculado.
CREATE OR REPLACE FUNCTION public.folha_upload_permitido(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.folha_importacao_tentativas t
    WHERE t.arquivo_path = _name AND t.usuario_id = auth.uid() AND t.estado = 'pendente'
      AND split_part(_name,'/',1) = t.unidade_id::text AND split_part(_name,'/',2) = t.competencia
      AND public.folha_pode(auth.uid(), t.unidade_id, 'importar'))
  AND NOT EXISTS (SELECT 1 FROM public.folha_contracheques c WHERE c.arquivo_path = _name) $$;
REVOKE ALL ON FUNCTION public.folha_upload_permitido(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.folha_upload_permitido(text) TO authenticated, service_role;

DROP POLICY IF EXISTS folha_docs_insert ON storage.objects;
CREATE POLICY folha_docs_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'folha-documentos' AND public.folha_upload_permitido(name));