CREATE OR REPLACE FUNCTION public.folha_pode_acessar(_user_id uuid, _unidade_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT _user_id IS NOT NULL AND public.has_role(_user_id, 'admin'::public.app_role) $$;
CREATE OR REPLACE FUNCTION public.folha_pode_global(_user_id uuid, _acao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT _user_id IS NOT NULL AND public.folha_chamador_pode_consultar(_user_id) AND public.has_role(_user_id, 'admin'::public.app_role) $$;
ALTER POLICY folha_perm_select ON public.folha_permissoes USING (public.has_role(auth.uid(), 'admin'::public.app_role));
COMMENT ON FUNCTION public.folha_pode_acessar(uuid, uuid) IS 'Temporary admin-only payroll/allowance restriction. Existing manager grants are preserved in folha_permissoes.';