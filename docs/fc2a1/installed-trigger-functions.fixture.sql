-- Isolated fixture: exact installed bodies except internal host replaced with example.invalid; net.http_post is stubbed. NOT A MIGRATION.
CREATE OR REPLACE FUNCTION public.check_duplicate_matricula()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.fechou_matricula = true THEN
    IF EXISTS (
      SELECT 1 FROM interacoes 
      WHERE lead_id = NEW.lead_id 
        AND fechou_matricula = true 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Este lead já possui uma matrícula registrada';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.cancel_follow_ups_on_matricula()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.fechou_matricula = true AND (OLD.fechou_matricula IS NULL OR OLD.fechou_matricula = false) THEN
    UPDATE follow_ups 
    SET status = 'cancelado', 
        cancelado_motivo = 'matriculado',
        updated_at = now()
    WHERE lead_id = NEW.lead_id 
      AND status = 'pendente'
      AND tipo IN ('D+1','D+7','D+15','D+30');
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.notify_experimental_presenca_http()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net', 'pg_temp'
AS $function$
BEGIN
  IF (NEW.compareceu IS DISTINCT FROM OLD.compareceu)
     OR (NEW.cancelado IS DISTINCT FROM OLD.cancelado)
     OR (NEW.data_experimental IS DISTINCT FROM OLD.data_experimental)
     OR (NEW.hora_experimental IS DISTINCT FROM OLD.hora_experimental) THEN
    PERFORM net.http_post(
      url := 'https://example.invalid/functions/v1/presenca-experimental-telegram',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', public.get_cron_secret()
      ),
      body := jsonb_build_object('acao', 'sincronizar', 'interacao_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.fu_gerencial_nova_matricula()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE l public.leads;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.cancelado=true OR NEW.fechou_matricula IS DISTINCT FROM true) THEN UPDATE public.tasks SET fu_gerencial_status='cancelado',fu_gerencial_envio_erro='Matrícula cancelada' WHERE fu_gerencial_matricula_id=NEW.id AND fu_gerencial_status IN ('pendente','em_andamento'); END IF;
 IF NEW.fechou_matricula IS DISTINCT FROM true OR NEW.data_fechamento IS NULL OR NEW.cancelado=true OR NEW.created_at<public.fu_gerencial_inicio() OR NEW.data_fechamento<(public.fu_gerencial_inicio() AT TIME ZONE 'America/Recife')::date THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.fechou_matricula=true AND OLD.data_fechamento IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO l FROM public.leads WHERE id=NEW.lead_id;
 IF l.ativo IS DISTINCT FROM true OR l.unidade_id IS NULL THEN RETURN NEW; END IF;
 UPDATE public.tasks SET fu_gerencial_status='cancelado',fu_gerencial_envio_erro='Novo ciclo de matrícula' WHERE fu_gerencial_lead_id=l.id AND fu_gerencial_matricula_id<>NEW.id AND fu_gerencial_status IN ('pendente','em_andamento');
 INSERT INTO public.tasks(titulo,descricao,responsavel,setor,prioridade,prazo,unidade_id,fu_gerencial_lead_id,fu_gerencial_matricula_id,fu_gerencial_etapa,fu_gerencial_status,notificado_24h,notificado_prazo) VALUES('ACOMPANHAMENTO GERENCIAL | M+30 | '||l.nome,'CONSULTAR HISTÓRICO ANTES DO CONTATO. VERIFICAR EXPERIÊNCIA, RECLAMAÇÕES E PROVIDÊNCIAS. NÃO REPETIR PERGUNTAS JÁ RESPONDIDAS.','[GERENTE]','GERENCIA','media',public.fu_next_weekday(NEW.data_fechamento+30),l.unidade_id,l.id,NEW.id,'M+30','pendente',true,true) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.fu_tecnico_nova_matricula()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE l public.leads; n integer;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.cancelado=true OR NEW.fechou_matricula IS DISTINCT FROM true) THEN
  UPDATE public.tasks SET fu_tecnico_status='cancelado',fu_tecnico_envio_erro='Matrícula cancelada' WHERE fu_tecnico_matricula_id=NEW.id AND fu_tecnico_status IN ('pendente','em_andamento');
 END IF;
 IF NEW.fechou_matricula IS DISTINCT FROM true OR NEW.data_fechamento IS NULL OR NEW.cancelado=true THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.fechou_matricula=true THEN RETURN NEW; END IF;
 SELECT * INTO l FROM public.leads WHERE id=NEW.lead_id;
 IF l.ativo IS DISTINCT FROM true OR l.unidade_id IS NULL THEN RETURN NEW; END IF;
 UPDATE public.tasks SET fu_tecnico_status='cancelado',fu_tecnico_envio_erro='Novo ciclo de matrícula' WHERE fu_tecnico_lead_id=l.id AND fu_tecnico_matricula_id<>NEW.id AND fu_tecnico_status IN ('pendente','em_andamento');
 -- No auth-derived grants are widened: creation is performed by this event trigger.
 FOR n IN SELECT unnest(ARRAY[7,21]) LOOP
  INSERT INTO public.tasks(titulo,descricao,responsavel,setor,prioridade,prazo,unidade_id,fu_tecnico_lead_id,fu_tecnico_matricula_id,fu_tecnico_etapa,fu_tecnico_status,notificado_24h,notificado_prazo)
  VALUES('ACOMPANHAMENTO TÉCNICO | M+'||n||' | '||l.nome,
   'CONSULTAR HISTÓRICO DO ALUNO, TREINOS E TREINADOR RESPONSÁVEL. VERIFICAR DIFICULDADES E ACOMPANHAMENTOS PRESENCIAIS. NÃO INVENTAR RESULTADOS.',
   '[COORDENADOR]','TECNICO','media',NEW.data_fechamento+n,l.unidade_id,l.id,NEW.id,'M+'||n,'pendente',true,true)
  ON CONFLICT DO NOTHING;
 END LOOP;
 RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.update_lead_status_on_matricula()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.fechou_matricula = true THEN
    PERFORM set_config('app.bypass_permissions', 'true', true);
    UPDATE leads
    SET status_funil = 'convertido', updated_at = now()
    WHERE id = NEW.lead_id
      AND status_funil NOT IN ('convertido', 'perdido');
    PERFORM set_config('app.bypass_permissions', 'false', true);
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.sync_hora_experimental_from_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  lead_hora TIME;
BEGIN
  -- Só sincroniza se a interação tem data_experimental definida
  IF NEW.data_experimental IS NOT NULL THEN
    -- Busca a hora do lead
    SELECT hora_aula_experimental INTO lead_hora
    FROM leads
    WHERE id = NEW.lead_id;
    
    -- Se o lead tem hora definida, usa ela na interação
    IF lead_hora IS NOT NULL THEN
      NEW.hora_experimental := lead_hora;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.validate_hora_experimental()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Se está agendando experimental, hora_experimental é obrigatória
  IF NEW.agendou_experimental = true AND NEW.hora_experimental IS NULL THEN
    RAISE EXCEPTION 'hora_experimental é obrigatória quando agendou_experimental é true';
  END IF;
  
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.uppercase_cadastrado_atendido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Convert cadastrado_por to uppercase if present
  IF NEW.cadastrado_por IS NOT NULL THEN
    NEW.cadastrado_por := UPPER(NEW.cadastrado_por);
  END IF;
  
  -- Convert atendido_por to uppercase if present
  IF NEW.atendido_por IS NOT NULL THEN
    NEW.atendido_por := UPPER(NEW.atendido_por);
  END IF;
  
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.fu_matriculados_nova_matricula()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE l public.leads; v_task uuid;
BEGIN
 IF NEW.cancelado=true OR NEW.fechou_matricula IS DISTINCT FROM true THEN
  UPDATE public.tasks SET status='concluida',fu_matriculados_envio_erro='Matrícula cancelada' WHERE fu_matriculados_matricula_id=NEW.id AND fu_matriculados_confirmado_em IS NULL;
  RETURN NEW;
 END IF;
 IF NEW.data_fechamento IS NULL OR NEW.created_at<public.fu_matriculados_inicio() OR NEW.data_fechamento<(public.fu_matriculados_inicio() AT TIME ZONE 'America/Recife')::date THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.fechou_matricula=true AND OLD.data_fechamento IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO l FROM public.leads WHERE id=NEW.lead_id;
 IF l.ativo IS DISTINCT FROM true OR l.unidade_id IS DISTINCT FROM NEW.unidade_id OR upper(coalesce(l.origem,'')) LIKE '%IMPORT%' OR upper(coalesce(NEW.tipo,'')) LIKE '%RENOVA%' OR EXISTS(SELECT 1 FROM public.interacoes WHERE lead_id=l.id AND unidade_id=l.unidade_id AND id<>NEW.id AND fechou_matricula=true AND cancelado IS DISTINCT FROM true) THEN RETURN NEW; END IF;
 INSERT INTO public.tasks(titulo,descricao,responsavel,setor,prioridade,prazo,unidade_id,fu_matriculados_lead_id,fu_matriculados_matricula_id,notificado_24h,notificado_prazo)
 VALUES('FU | MATRICULADOS | '||l.nome,'BOAS-VINDAS MANUAL PELO COMERCIAL. CONFIRMAR ENVIO NO TELEGRAM; ACOMPANHAMENTO SEPARADO.','[COMERCIAL]','COMERCIAL','media',public.fu_next_weekday((now() AT TIME ZONE 'America/Recife')::date),l.unidade_id,l.id,NEW.id,true,true)
 ON CONFLICT DO NOTHING RETURNING id INTO v_task;
 IF v_task IS NOT NULL THEN
  BEGIN
   PERFORM net.http_post(url:='https://example.invalid/functions/v1/notify-boas-vindas-matricula',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',public.get_cron_secret()),body:=jsonb_build_object('task_id',v_task));
  EXCEPTION WHEN OTHERS THEN NULL; END;
 END IF;
 RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.set_compareceu_em()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.compareceu IS TRUE AND (TG_OP = 'INSERT' OR OLD.compareceu IS DISTINCT FROM TRUE) THEN
    NEW.compareceu_em := now();
  END IF;
  IF NEW.compareceu IS NOT TRUE THEN
    NEW.compareceu_em := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.cancel_follow_ups_on_compareceu_undone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.compareceu = true AND (NEW.compareceu IS NULL OR NEW.compareceu = false) THEN
    UPDATE follow_ups
    SET status = 'cancelado',
        cancelado_motivo = 'compareceu_desmarcado',
        concluido_em = now(),
        concluido_por = 'SISTEMA (compareceu desmarcado)',
        updated_at = now()
    WHERE lead_id = NEW.lead_id
      AND status = 'pendente';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.sync_interacao_unidade_from_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lead_unidade_id uuid;
BEGIN
  -- Get the unidade_id from the lead
  SELECT unidade_id INTO v_lead_unidade_id
  FROM leads
  WHERE id = NEW.lead_id;
  
  -- If lead exists, use its unidade_id
  IF v_lead_unidade_id IS NOT NULL THEN
    NEW.unidade_id := v_lead_unidade_id;
  END IF;
  
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.validate_status_avaliacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status_avaliacao IS NOT NULL AND NEW.status_avaliacao NOT IN ('agendada', 'realizada', 'faltou', 'reagendada', 'cancelada') THEN
    RAISE EXCEPTION 'Invalid status_avaliacao value: %', NEW.status_avaliacao;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_lead_matriculado_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.fechou_matricula = true AND (OLD.fechou_matricula IS NULL OR OLD.fechou_matricula = false) THEN
    -- Use bypass to allow updating is_matriculado
    PERFORM set_config('app.bypass_permissions', 'true', true);
    UPDATE leads 
    SET is_matriculado = true, updated_at = now()
    WHERE id = NEW.lead_id;
    PERFORM set_config('app.bypass_permissions', 'false', true);
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.generate_follow_ups_on_attendance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lead RECORD;
  v_data_experimental DATE;
  v_ref TIMESTAMPTZ;
BEGIN
  IF NEW.compareceu = true AND (OLD.compareceu IS NULL OR OLD.compareceu = false) THEN
    SELECT * INTO v_lead FROM leads WHERE id = NEW.lead_id;

    IF v_lead IS NULL OR v_lead.is_matriculado = true OR v_lead.status_funil = 'perdido' THEN
      RETURN NEW;
    END IF;

    v_data_experimental := COALESCE(NEW.data_experimental, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
    -- meia-noite de Brasília do dia da experimental
    v_ref := (v_data_experimental::timestamp AT TIME ZONE 'America/Sao_Paulo');

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'D+1', v_ref, ((v_data_experimental + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'), 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'D+7', v_ref, ((v_data_experimental + 7)::timestamp AT TIME ZONE 'America/Sao_Paulo'), 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'D+15', v_ref, ((v_data_experimental + 15)::timestamp AT TIME ZONE 'America/Sao_Paulo'), 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'D+30', v_ref, ((v_data_experimental + 30)::timestamp AT TIME ZONE 'America/Sao_Paulo'), 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.cancel_follow_ups_on_reschedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.agendou_experimental = true
     AND NEW.data_experimental IS NOT NULL
     AND NEW.data_experimental >= CURRENT_DATE
     AND COALESCE(NEW.compareceu, false) = false THEN
    UPDATE follow_ups
    SET status = 'cancelado',
        cancelado_motivo = 'reagendado',
        concluido_em = now(),
        concluido_por = 'SISTEMA (reagendado)',
        updated_at = now()
    WHERE lead_id = NEW.lead_id
      AND status = 'pendente';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.generate_post_matricula_follow_ups()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_data_ref DATE;
  v_ref TIMESTAMPTZ;
BEGIN
  IF NEW.fechou_matricula = true AND (OLD.fechou_matricula IS NULL OR OLD.fechou_matricula = false) THEN
    v_data_ref := COALESCE(NEW.data_interacao::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
    v_ref := (v_data_ref::timestamp AT TIME ZONE 'America/Sao_Paulo');

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'M+7', v_ref, ((v_data_ref + 7)::timestamp AT TIME ZONE 'America/Sao_Paulo'), 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'M+30', v_ref, ((v_data_ref + 30)::timestamp AT TIME ZONE 'America/Sao_Paulo'), 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.contato_interacao_evidencia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE channel text; meta jsonb; contact_at timestamptz;
BEGIN
 IF TG_OP='UPDATE' AND NEW.contato_meta IS NOT DISTINCT FROM OLD.contato_meta THEN RETURN NEW; END IF;
 meta:=NEW.contato_meta;IF meta IS NULL OR meta->>'estado'<>'enviado' THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL AND NEW.created_by IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Responsável do contato inválido'; END IF;
 IF meta->>'canal' NOT IN ('whatsapp','presencial','telefone','outro') OR length(coalesce(meta->>'objetivo','')) NOT BETWEEN 1 AND 100 OR NEW.created_by IS NULL OR NEW.data_interacao>now() THEN RAISE EXCEPTION 'Contato realizado inválido'; END IF;
 channel:=meta->>'canal';contact_at:=NEW.data_interacao;
 PERFORM public.contato_registrar_evidencia(NEW.lead_id,NEW.unidade_id,'interacao:'||NEW.id,'crm_manual',meta->>'objetivo',nullif(meta->>'ciclo_id','')::uuid,meta->>'tipo_fu',coalesce(meta->>'setor','recepcao'),channel,NEW.atendido_por,contact_at,coalesce(meta->>'resultado',NEW.descricao),1,nullif(meta->>'excecao',''));RETURN NEW;
END $function$;