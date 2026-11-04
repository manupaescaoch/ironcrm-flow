-- CANDIDATO (não aplicado). Fase 5 — correções finais de segurança.
-- Consumidores legítimos verificados: cron (postgres), funções SECURITY DEFINER
-- e endpoints com service_role. Nenhum uso direto pela interface.

-- 1) Chave das automações: somente servidor
REVOKE EXECUTE ON FUNCTION public.get_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_secret() TO service_role;

-- 2) Funções administrativas: exigir admin no banco
CREATE OR REPLACE FUNCTION public.admin_assert_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN; END IF;
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada' USING ERRCODE = '42501';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_assert_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assert_admin() TO authenticated, service_role;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'admin_cleanup_duplicate_leads(uuid[])',
    'admin_standardize_origem(text,text)',
    'admin_standardize_treinador(text,text)',
    'admin_update_cadastrador(text,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;
-- Guarda injetada no início de cada corpo (texto restante idêntico ao original):
-- ver apply-guards.sql gerado a partir das definições salvas em originais.sql.

-- 3) task_history: autoria e unidade (trigger log_task_changes é SECURITY DEFINER
--    do proprietário e não é afetado por RLS)
DROP POLICY IF EXISTS insert_task_history_system ON public.task_history;
CREATE POLICY insert_task_history_own_unit ON public.task_history
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id
      AND (public.has_role(auth.uid(),'admin'::public.app_role)
           OR t.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))))
  );

-- 4) Telefones e reservas de envio: usados só por servidor/funções internas
REVOKE EXECUTE ON FUNCTION public.get_user_phone_by_name(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_whatsapp_envio(text,text,text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_whatsapp_envio(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reservar_envio_conta(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_follow_ups_for_lead(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_phone_by_name(text), public.claim_whatsapp_envio(text,text,text,text,integer),
  public.release_whatsapp_envio(text), public.reservar_envio_conta(uuid,text),
  public.generate_follow_ups_for_lead(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.admin_cleanup_duplicate_leads(lead_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_count integer;
BEGIN
  PERFORM public.admin_assert_admin();
  -- Set a session variable to indicate admin bypass
  PERFORM set_config('app.bypass_permissions', 'true', true);
  
  -- Update leads to inactive
  UPDATE leads 
  SET ativo = false, updated_at = now()
  WHERE id = ANY(lead_ids);
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Reset the session variable
  PERFORM set_config('app.bypass_permissions', 'false', true);
  
  RETURN affected_count;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_standardize_origem(old_value text, new_value text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_count integer;
BEGIN
  PERFORM public.admin_assert_admin();
  -- Set bypass flag
  PERFORM set_config('app.bypass_permissions', 'true', true);
  
  -- Update leads table
  UPDATE leads 
  SET origem = new_value, updated_at = now()
  WHERE UPPER(TRIM(origem)) = UPPER(TRIM(old_value));
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Reset bypass flag
  PERFORM set_config('app.bypass_permissions', 'false', true);
  
  RETURN affected_count;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_standardize_treinador(old_value text, new_value text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_count integer;
BEGIN
  PERFORM public.admin_assert_admin();
  -- Update interacoes table
  UPDATE interacoes 
  SET treinador_responsavel = new_value
  WHERE UPPER(TRIM(treinador_responsavel)) = UPPER(TRIM(old_value));
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Also update treinador_experimental if exists
  UPDATE interacoes 
  SET treinador_experimental = new_value
  WHERE UPPER(TRIM(treinador_experimental)) = UPPER(TRIM(old_value));
  
  RETURN affected_count;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_update_cadastrador(old_name text, new_name text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_count integer;
BEGIN
  PERFORM public.admin_assert_admin();
  -- Set bypass flag
  PERFORM set_config('app.bypass_permissions', 'true', true);
  
  -- Update leads table
  UPDATE leads 
  SET cadastrado_por = new_name, updated_at = now()
  WHERE UPPER(TRIM(cadastrado_por)) = UPPER(TRIM(old_name));
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Update interacoes table as well
  UPDATE interacoes 
  SET cadastrado_por = new_name
  WHERE UPPER(TRIM(cadastrado_por)) = UPPER(TRIM(old_name));
  
  -- Reset bypass flag
  PERFORM set_config('app.bypass_permissions', 'false', true);
  
  RETURN affected_count;
END;
$function$
;
