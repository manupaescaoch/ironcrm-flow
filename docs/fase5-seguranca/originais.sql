-- Definições originais (reversão)
CREATE OR REPLACE FUNCTION public.admin_cleanup_duplicate_leads(lead_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_count integer;
BEGIN
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
CREATE OR REPLACE FUNCTION public.claim_whatsapp_envio(p_chave text, p_funcao text, p_destino text DEFAULT NULL::text, p_canal text DEFAULT NULL::text, p_ttl_minutes integer DEFAULT 43200)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted integer;
BEGIN
  DELETE FROM public.whatsapp_idempotencia
  WHERE chave = p_chave AND expires_at < now();

  INSERT INTO public.whatsapp_idempotencia (chave, funcao, destino, canal, expires_at)
  VALUES (p_chave, p_funcao, p_destino, p_canal, now() + make_interval(mins => p_ttl_minutes))
  ON CONFLICT (chave) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.generate_follow_ups_for_lead(p_lead_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lead RECORD;
  v_data_referencia TIMESTAMP WITH TIME ZONE;
  v_ultima_interacao TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get lead info
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND ativo = true;
  
  -- Skip if lead not found or status is convertido/perdido
  IF v_lead IS NULL OR v_lead.status_funil IN ('convertido', 'perdido') THEN
    RETURN;
  END IF;
  
  -- Get last relevant interaction (experimental realizada or last contact)
  SELECT MAX(data_interacao) INTO v_ultima_interacao
  FROM interacoes 
  WHERE lead_id = p_lead_id 
    AND (compareceu = true OR tipo IN ('contato', 'ligacao', 'whatsapp', 'email'));
  
  -- Use experimental date if available, otherwise use last interaction or created_at
  IF v_lead.data_aula_experimental IS NOT NULL AND EXISTS (
    SELECT 1 FROM interacoes WHERE lead_id = p_lead_id AND compareceu = true
  ) THEN
    v_data_referencia := v_lead.data_aula_experimental;
  ELSIF v_ultima_interacao IS NOT NULL THEN
    v_data_referencia := v_ultima_interacao;
  ELSE
    v_data_referencia := v_lead.created_at;
  END IF;
  
  -- Insert D+7 follow-up if doesn't exist
  INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista)
  VALUES (p_lead_id, v_lead.unidade_id, 'D+7', v_data_referencia, v_data_referencia + INTERVAL '7 days')
  ON CONFLICT (lead_id, tipo) DO NOTHING;
  
  -- Insert D+15 follow-up if doesn't exist
  INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista)
  VALUES (p_lead_id, v_lead.unidade_id, 'D+15', v_data_referencia, v_data_referencia + INTERVAL '15 days')
  ON CONFLICT (lead_id, tipo) DO NOTHING;
  
  -- Insert D+30 follow-up if doesn't exist
  INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista)
  VALUES (p_lead_id, v_lead.unidade_id, 'D+30', v_data_referencia, v_data_referencia + INTERVAL '30 days')
  ON CONFLICT (lead_id, tipo) DO NOTHING;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_cron_secret()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v text;
BEGIN
  SELECT valor INTO v FROM public.app_config WHERE chave = 'cron_secret';
  RETURN v;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_user_phone_by_name(p_name text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT up.telefone 
  FROM user_profiles up
  JOIN auth.users au ON au.id = up.user_id
  WHERE UPPER(COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '')) = UPPER(TRIM(p_name))
    AND up.telefone IS NOT NULL
    AND up.telefone != ''
  LIMIT 1
$function$
;
CREATE OR REPLACE FUNCTION public.release_whatsapp_envio(p_chave text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DELETE FROM public.whatsapp_idempotencia WHERE chave = p_chave;
$function$
;
CREATE OR REPLACE FUNCTION public.reservar_envio_conta(p_conta_id uuid, p_tipo text)
 RETURNS contas_pagar_envios
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.contas_pagar_envios;
  v_unidade uuid;
BEGIN
  IF p_tipo NOT IN ('CADASTRO','VENCIMENTO') THEN
    RAISE EXCEPTION 'tipo_envio inválido';
  END IF;

  SELECT unidade_id INTO v_unidade FROM public.contas_pagar WHERE id = p_conta_id;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  INSERT INTO public.contas_pagar_envios (conta_id, unidade_id, tipo_envio, status, proxima_tentativa_em)
  VALUES (p_conta_id, v_unidade, p_tipo, 'aguardando_envio', now())
  ON CONFLICT (conta_id, tipo_envio) DO NOTHING;

  UPDATE public.contas_pagar_envios
     SET status = 'enviando',
         tentativas = tentativas + 1,
         ultima_tentativa_em = now(),
         updated_at = now()
   WHERE conta_id = p_conta_id
     AND tipo_envio = p_tipo
     AND status IN ('aguardando_envio','falhou')
  RETURNING * INTO v_row;

  RETURN v_row; -- NULL quando já enviado / enviando / cancelado
END;
$function$
;
-- Privilégios originais: EXECUTE para PUBLIC/anon/authenticated nas 10 funções;
-- política original de task_history:
-- CREATE POLICY insert_task_history_system ON public.task_history FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);
