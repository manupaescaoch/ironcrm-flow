DO $$
DECLARE r record; u record; esperado boolean;
BEGIN
 FOR r IN SELECT user_id, role FROM public.user_roles LOOP
  esperado := public.has_role(r.user_id, 'admin'::public.app_role);
  IF public.folha_pode_global(r.user_id, 'ver') IS DISTINCT FROM esperado OR public.folha_pode_global(r.user_id, 'documentos') IS DISTINCT FROM esperado THEN
   RAISE EXCEPTION 'Falha no bloqueio global da folha';
  END IF;
  FOR u IN SELECT id FROM public.unidades LOOP
   IF public.folha_pode(r.user_id,u.id,'ver') IS DISTINCT FROM esperado OR public.folha_pode(r.user_id,u.id,'lancar') IS DISTINCT FROM esperado OR public.folha_pode(r.user_id,u.id,'importar') IS DISTINCT FROM esperado THEN
    RAISE EXCEPTION 'Falha no bloqueio de leitura, gravação ou documentos da folha';
   END IF;
  END LOOP;
 END LOOP;
 IF public.folha_pode_acessar(NULL,NULL) OR public.folha_pode_global(NULL,'ver') THEN RAISE EXCEPTION 'Acesso sem usuário deve ser bloqueado'; END IF;
END $$;