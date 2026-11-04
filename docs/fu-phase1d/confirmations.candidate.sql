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
