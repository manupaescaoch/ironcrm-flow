CREATE OR REPLACE FUNCTION public.folha_pode_acessar(_user_id uuid, _unidade_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$ SELECT _user_id IS NOT NULL AND (public.has_role(_user_id,'admin'::public.app_role) OR (public.has_role(_user_id,'gerente'::public.app_role) AND EXISTS(SELECT 1 FROM public.user_unidades WHERE user_id=_user_id AND unidade_id=_unidade_id))) $$;
COMMENT ON FUNCTION public.folha_pode_acessar(uuid,uuid) IS 'DEPRECATED API: explicit admin/linked gerente gate; action authorization uses folha_pode.';
CREATE OR REPLACE FUNCTION public.folha_pode(_user_id uuid, _unidade_id uuid, _acao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$ SELECT public.folha_pode_acessar(_user_id,_unidade_id) AND public.folha_pode_global(_user_id,_acao) $$;