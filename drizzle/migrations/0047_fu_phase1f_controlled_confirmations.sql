-- ISOLATED DEVELOPMENT ONLY. No production application authorized.
CREATE OR REPLACE FUNCTION public.fu_crm_confirmar_envio(p_task uuid,p_actor uuid,p_lead uuid,p_matricula uuid,p_unidade uuid,p_etapa text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.tasks; j jsonb; pref text; v_name text; v_at timestamptz; v_history text; n int;
BEGIN
 SELECT * INTO t FROM public.tasks WHERE id=p_task FOR UPDATE; j:=to_jsonb(t);
 IF t.id IS NULL THEN RAISE EXCEPTION 'Tarefa não encontrada' USING ERRCODE='P0002'; END IF;
 pref:=CASE WHEN t.fu_tecnico_etapa IS NOT NULL THEN 'fu_tecnico' WHEN t.fu_gerencial_etapa IS NOT NULL THEN 'fu_gerencial' WHEN t.fu_matriculados_matricula_id IS NOT NULL THEN 'fu_matriculados' END;
 IF pref IS NULL OR (SELECT count(*) FROM (VALUES(t.fu_tecnico_matricula_id),(t.fu_gerencial_matricula_id),(t.fu_matriculados_matricula_id)) x(v) WHERE v IS NOT NULL)<>1 THEN RAISE EXCEPTION 'Identidade inválida' USING ERRCODE='22023'; END IF;
 IF t.unidade_id IS DISTINCT FROM p_unidade OR (j->>(pref||'_lead_id'))::uuid IS DISTINCT FROM p_lead OR (j->>(pref||'_matricula_id'))::uuid IS DISTINCT FROM p_matricula OR j->>(pref||'_etapa') IS DISTINCT FROM p_etapa THEN RAISE EXCEPTION 'Seleção obsoleta' USING ERRCODE='22023'; END IF;
 IF NOT (public.has_role(p_actor,'admin') OR (EXISTS(SELECT 1 FROM public.user_unidades WHERE user_id=p_actor AND unidade_id=p_unidade) AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_actor AND ((pref='fu_gerencial' AND role::text='gerente') OR(pref='fu_tecnico' AND role::text IN('gerente','coordenador')) OR(pref='fu_matriculados' AND role::text IN('user','moderator')))))) THEN RAISE EXCEPTION 'Perfil ou unidade não autorizado' USING ERRCODE='42501'; END IF;
 IF NOT ((pref='fu_tecnico' AND p_etapa IN('M+7','M+21')) OR(pref='fu_gerencial' AND p_etapa IN('M+15','M+30')) OR(pref='fu_matriculados' AND p_etapa IN('BV','M+3','M+32'))) THEN RAISE EXCEPTION 'Etapa inválida' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.leads WHERE id=p_lead AND unidade_id=p_unidade AND ativo=true AND is_matriculado=true AND status_funil IS DISTINCT FROM 'perdido') OR NOT EXISTS(SELECT 1 FROM public.interacoes WHERE id=p_matricula AND lead_id=p_lead AND unidade_id=p_unidade AND fechou_matricula=true AND cancelado IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Matrícula inativa ou identidade inválida' USING ERRCODE='22023'; END IF;
 v_at:=(j->>(pref||'_confirmado_em'))::timestamptz; v_name:=j->>(pref||'_confirmado_nome');
 IF v_at IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'duplicado',true,'confirmado_em',v_at,'responsavel',v_name,'task_id',p_task,'lead_id',p_lead,'matricula_id',p_matricula,'unidade_id',p_unidade,'etapa',p_etapa); END IF;
 IF t.status='concluida' OR coalesce(j->>(pref||'_status'),'') IN('concluido','dispensado','cancelado') OR coalesce(j->>'arquivada','false')='true' THEN RAISE EXCEPTION 'Acompanhamento encerrado' USING ERRCODE='22023'; END IF;
 SELECT nome INTO v_name FROM public.cronograma_funcionarios WHERE user_id=p_actor AND unidade_id=p_unidade AND ativo=true ORDER BY id LIMIT 1;
 v_name:=coalesce(nullif(trim(v_name),''),'USUÁRIO CRM'); v_at:=now();
 -- Context is set only inside this service-only function; the trigger also checks database role.
 PERFORM set_config('app.fu_confirmation_origin','crm',true);
 IF pref='fu_tecnico' THEN UPDATE public.tasks SET fu_tecnico_confirmado_em=v_at,fu_tecnico_confirmado_por=p_actor,fu_tecnico_confirmado_nome=v_name WHERE id=p_task;
 ELSIF pref='fu_gerencial' THEN UPDATE public.tasks SET fu_gerencial_confirmado_em=v_at,fu_gerencial_confirmado_por=p_actor,fu_gerencial_confirmado_nome=v_name WHERE id=p_task;
 ELSE UPDATE public.tasks SET fu_matriculados_confirmado_em=v_at,fu_matriculados_confirmado_por=p_actor,fu_matriculados_confirmado_nome=v_name WHERE id=p_task;
 IF p_etapa='BV' THEN UPDATE public.interacoes SET boas_vindas_enviada_em=v_at WHERE id=p_matricula; END IF; END IF;
 v_history:=CASE WHEN pref='fu_matriculados' AND p_etapa<>'BV' THEN 'fu_recepcao_envio_aluno' ELSE pref||'_envio_aluno' END;
 INSERT INTO public.task_history(task_id,user_id,user_name,campo,valor_anterior,valor_novo) VALUES(p_task,p_actor,v_name,v_history,'pendente',jsonb_build_object('status','enviado','etapa',p_etapa,'confirmado_em',v_at,'origem','crm')::text);
 PERFORM set_config('app.fu_confirmation_origin','',true);
 RETURN jsonb_build_object('ok',true,'duplicado',false,'confirmado_em',v_at,'responsavel',v_name,'task_id',p_task,'lead_id',p_lead,'matricula_id',p_matricula,'unidade_id',p_unidade,'etapa',p_etapa);
END $$;
REVOKE ALL ON FUNCTION public.fu_crm_confirmar_envio(uuid,uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_crm_confirmar_envio(uuid,uuid,uuid,uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fu_comercial_confirmar_transacional(p_fu uuid,p_actor uuid,p_lead uuid,p_unidade uuid,p_etapa text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public.follow_ups; v_at timestamptz; v_name text; hid uuid; h text; bytes bytea; pending_history boolean;
BEGIN
 SELECT * INTO f FROM public.follow_ups WHERE id=p_fu FOR UPDATE;
 IF f.id IS NULL OR f.lead_id IS DISTINCT FROM p_lead OR f.unidade_id IS DISTINCT FROM p_unidade OR f.tipo IS DISTINCT FROM p_etapa OR p_etapa NOT IN('D+1','D+7','D+15') THEN RAISE EXCEPTION 'Follow-up inválido' USING ERRCODE='22023'; END IF;
 IF NOT(public.has_role(p_actor,'admin') OR(public.has_role(p_actor,'user') AND EXISTS(SELECT 1 FROM public.user_unidades WHERE user_id=p_actor AND unidade_id=p_unidade))) THEN RAISE EXCEPTION 'Perfil ou unidade não autorizado' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.leads WHERE id=p_lead AND unidade_id=p_unidade) THEN RAISE EXCEPTION 'Aluno inválido' USING ERRCODE='22023'; END IF;
 IF f.status NOT IN('pendente','concluido') OR(f.status='concluido' AND f.concluido_em IS NULL) THEN RAISE EXCEPTION 'Follow-up não confirmável' USING ERRCODE='22023'; END IF;
 v_at:=coalesce(f.concluido_em,now());
 -- Matches commercialHistoryId's SHA-256 first 16 bytes with UUID version/variant bits.
 bytes:=decode(substr(encode(sha256(convert_to('fu-confirmation:'||p_fu::text||':'||to_char(v_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'UTF8')),'hex'),1,32),'hex');
 bytes:=set_byte(bytes,6,(get_byte(bytes,6)&15)|80);bytes:=set_byte(bytes,8,(get_byte(bytes,8)&63)|128); h:=encode(bytes,'hex');hid:=(substr(h,1,8)||'-'||substr(h,9,4)||'-'||substr(h,13,4)||'-'||substr(h,17,4)||'-'||substr(h,21,12))::uuid;
 IF f.status='concluido' THEN pending_history:=NOT EXISTS(SELECT 1 FROM public.interacoes WHERE id=hid AND lead_id=p_lead AND unidade_id=p_unidade); RETURN jsonb_build_object('row',to_jsonb(f),'alreadyConfirmed',true,'historyPending',pending_history); END IF;
 SELECT nome INTO v_name FROM public.cronograma_funcionarios WHERE user_id=p_actor AND unidade_id=p_unidade AND ativo=true ORDER BY id LIMIT 1;v_name:=coalesce(nullif(trim(v_name),''),'USUÁRIO CRM');
 UPDATE public.follow_ups SET status='concluido',concluido_em=v_at,concluido_por=v_name WHERE id=p_fu RETURNING * INTO f;
 INSERT INTO public.interacoes(id,lead_id,unidade_id,tipo,descricao,data_interacao,atendido_por,created_by) VALUES(hid,p_lead,p_unidade,'Follow Up','Follow-up '||p_etapa||' realizado via WhatsApp',v_at,v_name,p_actor);
 RETURN jsonb_build_object('row',to_jsonb(f),'alreadyConfirmed',false,'historyPending',false,'historyId',hid);
END $$;
REVOKE ALL ON FUNCTION public.fu_comercial_confirmar_transacional(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_comercial_confirmar_transacional(uuid,uuid,uuid,uuid,text) TO service_role;
-- ISOLATED ONLY: narrow origin/stage correction; preserves keys, spacing policy and old evidence.
CREATE OR REPLACE FUNCTION public.contato_tarefa_evidencia() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j jsonb; oldj jsonb; prefix text; person uuid; cycle uuid; objective text; sector text; priority int; r jsonb; d timestamptz; k text; origin text;
BEGIN
 j:=to_jsonb(NEW);oldj:=to_jsonb(OLD);
 origin:=CASE WHEN current_setting('app.fu_confirmation_origin',true)='crm' AND (current_setting('role',true)='service_role' OR session_user NOT IN('anon','authenticated','authenticator')) THEN 'CRM' ELSE 'Telegram' END;
 FOREACH prefix IN ARRAY ARRAY['fu_tecnico','fu_gerencial','fu_matriculados'] LOOP
 person:=nullif(j->>(prefix||'_lead_id'),'')::uuid;cycle:=nullif(j->>(prefix||'_matricula_id'),'')::uuid;IF person IS NULL THEN CONTINUE; END IF;
 objective:=CASE prefix WHEN 'fu_tecnico' THEN 'tecnico' WHEN 'fu_gerencial' THEN 'experiencia' ELSE CASE WHEN j->>'fu_matriculados_etapa' IN('M+3','M+32') THEN 'experiencia' ELSE 'boas_vindas' END END;
 sector:=CASE prefix WHEN 'fu_tecnico' THEN 'coordenador' WHEN 'fu_gerencial' THEN 'gerente' ELSE 'comercial' END;priority:=CASE prefix WHEN 'fu_tecnico' THEN 2 WHEN 'fu_gerencial' THEN 3 ELSE 4 END;
 IF j->>(prefix||'_confirmado_em') IS NOT NULL AND oldj->>(prefix||'_confirmado_em') IS NULL THEN PERFORM public.contato_registrar_evidencia(person,NEW.unidade_id,'manual:'||prefix||':'||NEW.id,prefix,objective,cycle,j->>(prefix||'_etapa'),sector,'whatsapp',j->>(prefix||'_confirmado_nome'),(j->>(prefix||'_confirmado_em'))::timestamptz,'Confirmação manual '||origin||'; etapa '||coalesce(j->>(prefix||'_etapa'),'')||'; acompanhamento separado',priority,CASE WHEN prefix='fu_matriculados' THEN 'transicao_matricula' END); END IF;
 r:=j->(prefix||'_registro');
 IF r IS NOT NULL AND r->>'canal' IN('presencial','whatsapp') AND j->>(prefix||'_status')='concluido' AND oldj->>(prefix||'_status') IS DISTINCT FROM 'concluido' THEN
 d:=((r->>'data')::date+time '23:59:59') AT TIME ZONE 'America/Recife';d:=least(d,now());k:='registro:'||prefix||':'||NEW.id;
 PERFORM public.contato_registrar_evidencia(person,NEW.unidade_id,k,prefix,objective,cycle,j->>(prefix||'_etapa'),sector,r->>'canal',coalesce(r->>'coordenador',r->>'gerente',NEW.responsavel),d,r::text,priority);
 UPDATE public.contato_execucoes SET acompanhamento_concluido_em=now() WHERE chave=k;
 END IF;
 END LOOP;RETURN NEW;
END $$;
-- ISOLATED ONLY. Preserve callback routing/signatures and historical data.
CREATE OR REPLACE FUNCTION public.fu_gerencial_confirmar_envio(p_task uuid, p_telegram_user bigint, p_chat bigint, p_message bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE t public.tasks; l public.leads; v_user uuid; v_nome text; v_unit text;
BEGIN
 SELECT * INTO t FROM public.tasks WHERE id=p_task FOR UPDATE;
 IF t.id IS NULL OR t.fu_gerencial_etapa IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','Tarefa não encontrada.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.telegram_groups WHERE unidade_id=t.unidade_id AND group_type='gerencia' AND status='conectado' AND telegram_chat_id=p_chat) THEN RETURN jsonb_build_object('ok',false,'erro','Confirmação permitida apenas no grupo GERENTE da unidade atual.'); END IF;
 SELECT user_id INTO v_user FROM public.telegram_users WHERE telegram_user_id=p_telegram_user AND status='conectado';
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role::text IN ('admin','gerente')) OR NOT(public.has_role(v_user,'admin') OR EXISTS(SELECT 1 FROM public.user_unidades WHERE user_id=v_user AND unidade_id=t.unidade_id)) THEN RETURN jsonb_build_object('ok',false,'erro','Seu Telegram precisa estar vinculado a um usuário autorizado da unidade.'); END IF;
 IF t.fu_gerencial_telegram_chat_id IS DISTINCT FROM p_chat OR t.fu_gerencial_telegram_message_id IS DISTINCT FROM p_message THEN RETURN jsonb_build_object('ok',false,'erro','Este aviso foi substituído ou pertence a outra tarefa.'); END IF;
 SELECT * INTO l FROM public.leads WHERE id=t.fu_gerencial_lead_id;
 IF t.fu_gerencial_status IN ('concluido','dispensado','cancelado') OR l.ativo IS DISTINCT FROM true OR l.is_matriculado IS DISTINCT FROM true OR l.unidade_id IS DISTINCT FROM t.unidade_id OR l.status_funil='perdido' OR NOT EXISTS(SELECT 1 FROM public.interacoes WHERE id=t.fu_gerencial_matricula_id AND fechou_matricula=true AND cancelado IS DISTINCT FROM true) THEN RETURN jsonb_build_object('ok',false,'erro','Acompanhamento encerrado ou matrícula inativa.'); END IF;
 SELECT nome INTO v_nome FROM public.cronograma_funcionarios WHERE user_id=v_user AND unidade_id=t.unidade_id AND ativo=true ORDER BY id LIMIT 1;
 v_nome:=coalesce(nullif(trim(v_nome),''),(SELECT nullif(trim(concat_ws(' ',telegram_first_name,telegram_last_name)),'') FROM public.telegram_users WHERE user_id=v_user),'GERENTE');
 SELECT nome INTO v_unit FROM public.unidades WHERE id=t.unidade_id;
 IF t.fu_gerencial_confirmado_em IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'duplicado',true,'confirmado_em',t.fu_gerencial_confirmado_em,'responsavel',t.fu_gerencial_confirmado_nome,'unidade',v_unit,'aluno',l.nome,'etapa',t.fu_gerencial_etapa); END IF;
 UPDATE public.tasks SET fu_gerencial_confirmado_em=now(),fu_gerencial_confirmado_por=v_user,fu_gerencial_confirmado_telegram_id=p_telegram_user,fu_gerencial_confirmado_nome=v_nome WHERE id=t.id;
 INSERT INTO public.task_history(task_id,user_id,user_name,campo,valor_anterior,valor_novo) VALUES(t.id,v_user,v_nome,'fu_gerencial_envio_aluno','pendente',jsonb_build_object('status','enviado','confirmado_em',now(),'telegram_user_id',p_telegram_user)::text);
 RETURN jsonb_build_object('ok',true,'duplicado',false,'confirmado_em',now(),'responsavel',v_nome,'unidade',v_unit,'aluno',l.nome,'etapa',t.fu_gerencial_etapa);
END $function$;

CREATE OR REPLACE FUNCTION public.fu_matriculados_confirmar_envio(p_task uuid, p_telegram_user bigint, p_chat bigint, p_message bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE t public.tasks; l public.leads; v_user uuid; v_nome text; v_unit text;
BEGIN
 SELECT * INTO t FROM public.tasks WHERE id=p_task FOR UPDATE;
 IF t.fu_matriculados_matricula_id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','FU não encontrado.'); END IF;
 SELECT user_id INTO v_user FROM public.telegram_users WHERE telegram_user_id=p_telegram_user AND status='conectado';
 IF v_user IS NULL OR NOT (public.has_role(v_user,'admin') OR ((public.has_role(v_user,'user') OR (public.has_role(v_user,'moderator') AND t.fu_matriculados_etapa IN('BV','M+3','M+32'))) AND EXISTS(SELECT 1 FROM public.user_unidades WHERE user_id=v_user AND unidade_id=t.unidade_id))) THEN RETURN jsonb_build_object('ok',false,'erro','Vincule seu Telegram a um usuário autorizado da unidade.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.telegram_groups WHERE unidade_id=t.unidade_id AND group_type='comercial' AND status='conectado' AND telegram_chat_id=p_chat) OR t.fu_matriculados_chat_id IS DISTINCT FROM p_chat OR t.fu_matriculados_message_id IS DISTINCT FROM p_message THEN RETURN jsonb_build_object('ok',false,'erro','Aviso inválido ou substituído; utilize o COMERCIAL da unidade atual.'); END IF;
 SELECT * INTO l FROM public.leads WHERE id=t.fu_matriculados_lead_id;
 IF l.ativo IS DISTINCT FROM true OR l.is_matriculado IS DISTINCT FROM true OR l.unidade_id IS DISTINCT FROM t.unidade_id OR NOT EXISTS(SELECT 1 FROM public.interacoes WHERE id=t.fu_matriculados_matricula_id AND fechou_matricula=true AND cancelado IS DISTINCT FROM true) THEN RETURN jsonb_build_object('ok',false,'erro','Matrícula inativa.'); END IF;
 SELECT nome INTO v_unit FROM public.unidades WHERE id=t.unidade_id;
 IF t.fu_matriculados_confirmado_em IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'duplicado',true,'confirmado_em',t.fu_matriculados_confirmado_em,'responsavel',t.fu_matriculados_confirmado_nome,'unidade',v_unit,'aluno',l.nome,'etapa',t.fu_matriculados_etapa); END IF;
 IF t.status='concluida' THEN RETURN jsonb_build_object('ok',false,'erro','Acompanhamento encerrado.'); END IF;
 SELECT nome INTO v_nome FROM public.cronograma_funcionarios WHERE user_id=v_user AND unidade_id=t.unidade_id AND ativo=true ORDER BY id LIMIT 1;
 v_nome:=coalesce(v_nome,(SELECT nullif(trim(concat_ws(' ',telegram_first_name,telegram_last_name)),'') FROM public.telegram_users WHERE user_id=v_user),CASE WHEN t.fu_matriculados_etapa='BV' THEN 'COMERCIAL' ELSE 'RECEPÇÃO' END);
 UPDATE public.tasks SET fu_matriculados_confirmado_em=now(),fu_matriculados_confirmado_por=v_user,fu_matriculados_confirmado_nome=v_nome WHERE id=t.id;
 IF t.fu_matriculados_etapa='BV' THEN UPDATE public.interacoes SET boas_vindas_enviada_em=now() WHERE id=t.fu_matriculados_matricula_id; END IF;
 INSERT INTO public.task_history(task_id,user_id,user_name,campo,valor_anterior,valor_novo) VALUES(t.id,v_user,v_nome,CASE WHEN t.fu_matriculados_etapa='BV' THEN 'fu_matriculados_envio_aluno' ELSE 'fu_recepcao_envio_aluno' END,'pendente',jsonb_build_object('status','enviado','etapa',t.fu_matriculados_etapa,'confirmado_em',now(),'telegram_user_id',p_telegram_user)::text);
 RETURN jsonb_build_object('ok',true,'duplicado',false,'confirmado_em',now(),'responsavel',v_nome,'unidade',v_unit,'aluno',l.nome,'etapa',t.fu_matriculados_etapa);
END $function$;

CREATE OR REPLACE FUNCTION public.fu_tecnico_confirmar_envio(p_task uuid, p_telegram_user bigint, p_chat bigint, p_message bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE t public.tasks; l public.leads; v_user uuid; v_nome text; v_unit text;
BEGIN
 SELECT * INTO t FROM public.tasks WHERE id=p_task FOR UPDATE;
 IF t.id IS NULL OR t.fu_tecnico_etapa IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','Tarefa não encontrada.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.telegram_groups WHERE unidade_id=t.unidade_id AND group_type='coordenadores' AND status='conectado' AND telegram_chat_id=p_chat) THEN
 RETURN jsonb_build_object('ok',false,'erro','Confirmação permitida apenas no grupo COORDENADOR da unidade atual.'); END IF;
 SELECT user_id INTO v_user FROM public.telegram_users WHERE telegram_user_id=p_telegram_user AND status='conectado';
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role::text IN ('admin','gerente','coordenador')) OR
 NOT (public.has_role(v_user,'admin') OR EXISTS(SELECT 1 FROM public.user_unidades WHERE user_id=v_user AND unidade_id=t.unidade_id)) THEN
 RETURN jsonb_build_object('ok',false,'erro','Seu Telegram precisa estar vinculado a um usuário autorizado da unidade.'); END IF;
 IF t.fu_tecnico_telegram_chat_id IS DISTINCT FROM p_chat OR t.fu_tecnico_telegram_message_id IS DISTINCT FROM p_message THEN
 RETURN jsonb_build_object('ok',false,'erro','Este aviso foi substituído ou pertence a outra tarefa.'); END IF;
 SELECT * INTO l FROM public.leads WHERE id=t.fu_tecnico_lead_id;
 IF t.fu_tecnico_status IN ('concluido','dispensado','cancelado') OR l.ativo IS DISTINCT FROM true OR l.is_matriculado IS DISTINCT FROM true OR l.unidade_id IS DISTINCT FROM t.unidade_id OR l.status_funil='perdido' OR
 NOT EXISTS(SELECT 1 FROM public.interacoes WHERE id=t.fu_tecnico_matricula_id AND fechou_matricula=true AND cancelado IS DISTINCT FROM true) THEN
 RETURN jsonb_build_object('ok',false,'erro','Acompanhamento encerrado ou matrícula inativa.'); END IF;
 SELECT nome INTO v_nome FROM public.cronograma_funcionarios WHERE user_id=v_user AND unidade_id=t.unidade_id AND ativo=true ORDER BY id LIMIT 1;
 v_nome:=coalesce(nullif(trim(v_nome),''),(SELECT nullif(trim(concat_ws(' ',telegram_first_name,telegram_last_name)),'') FROM public.telegram_users WHERE user_id=v_user),'COORDENADOR');
 SELECT nome INTO v_unit FROM public.unidades WHERE id=t.unidade_id;
 IF t.fu_tecnico_confirmado_em IS NOT NULL THEN
 RETURN jsonb_build_object('ok',true,'duplicado',true,'confirmado_em',t.fu_tecnico_confirmado_em,'responsavel',t.fu_tecnico_confirmado_nome,'unidade',v_unit,'aluno',l.nome,'etapa',t.fu_tecnico_etapa); END IF;
 UPDATE public.tasks SET fu_tecnico_confirmado_em=now(),fu_tecnico_confirmado_por=v_user,fu_tecnico_confirmado_telegram_id=p_telegram_user,fu_tecnico_confirmado_nome=v_nome WHERE id=t.id;
 INSERT INTO public.task_history(task_id,user_id,user_name,campo,valor_anterior,valor_novo) VALUES(t.id,v_user,v_nome,'fu_tecnico_envio_aluno','pendente',jsonb_build_object('status','enviado','confirmado_em',now(),'telegram_user_id',p_telegram_user)::text);
 RETURN jsonb_build_object('ok',true,'duplicado',false,'confirmado_em',now(),'responsavel',v_nome,'unidade',v_unit,'aluno',l.nome,'etapa',t.fu_tecnico_etapa);
END $function$;