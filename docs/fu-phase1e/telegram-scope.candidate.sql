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
 INSERT INTO public.task_history(task_id,user_id,user_name,campo,valor_anterior,valor_novo)
 VALUES(t.id,v_user,v_nome,'fu_tecnico_envio_aluno','pendente',jsonb_build_object('status','enviado','confirmado_em',now(),'telegram_user_id',p_telegram_user)::text);
 RETURN jsonb_build_object('ok',true,'duplicado',false,'confirmado_em',now(),'responsavel',v_nome,'unidade',v_unit,'aluno',l.nome,'etapa',t.fu_tecnico_etapa);
END $function$;
