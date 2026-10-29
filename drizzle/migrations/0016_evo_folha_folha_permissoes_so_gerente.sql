-- Folha: além do admin, somente gerentes podem receber permissões (comercial/recepção/coordenador nunca).
CREATE OR REPLACE FUNCTION public.folha_pode_global(_user_id uuid, _acao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id,'admin'::public.app_role)
    OR (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='gerente'::public.app_role)
        AND EXISTS (SELECT 1 FROM public.folha_permissoes WHERE user_id=_user_id AND acao=_acao)))
$$;