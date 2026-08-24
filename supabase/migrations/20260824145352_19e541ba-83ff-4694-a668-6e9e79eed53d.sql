-- 1. formulario_campos: anon só lê campos de formulários ativos
DROP POLICY IF EXISTS select_formulario_campos_anon ON public.formulario_campos;
CREATE POLICY select_formulario_campos_anon
ON public.formulario_campos
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.formularios f
    WHERE f.id = formulario_campos.formulario_id
      AND f.ativo = true
  )
);

-- 2. unidades: apenas unidades vinculadas ao usuário (admin vê todas)
DROP POLICY IF EXISTS "Authenticated can view unidades" ON public.unidades;
CREATE POLICY "Authenticated can view unidades"
ON public.unidades
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR id IN (SELECT public.get_user_unidades(auth.uid()))
);

-- 3. view consolidada de atendimentos: leitura autenticada (estava sem grants)
GRANT SELECT ON public.v_operacional_atendimentos TO authenticated;

-- 4. SECURITY DEFINER: remover EXECUTE de public/anon, manter authenticated + service_role
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname <> 'submit_nps_resposta'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- RPC pública de NPS continua acessível a visitantes
GRANT EXECUTE ON FUNCTION public.submit_nps_resposta(text, text, text, smallint, smallint, smallint, smallint, text[], text[], text, text) TO anon, authenticated, service_role;