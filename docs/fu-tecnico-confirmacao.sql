ALTER TABLE public.tasks
 ADD COLUMN fu_tecnico_confirmado_em timestamptz,
 ADD COLUMN fu_tecnico_confirmado_por uuid,
 ADD COLUMN fu_tecnico_confirmado_telegram_id bigint,
 ADD COLUMN fu_tecnico_confirmado_nome text,
 ADD COLUMN fu_tecnico_telegram_chat_id bigint,
 ADD COLUMN fu_tecnico_telegram_message_id bigint;

CREATE OR REPLACE FUNCTION public.fu_tecnico_proteger_confirmacao() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND pg_trigger_depth()=1 AND (
 NEW.fu_tecnico_confirmado_em IS DISTINCT FROM OLD.fu_tecnico_confirmado_em OR
 NEW.fu_tecnico_confirmado_por IS DISTINCT FROM OLD.fu_tecnico_confirmado_por OR
 NEW.fu_tecnico_confirmado_telegram_id IS DISTINCT FROM OLD.fu_tecnico_confirmado_telegram_id OR
 NEW.fu_tecnico_confirmado_nome IS DISTINCT FROM OLD.fu_tecnico_confirmado_nome OR
 NEW.fu_tecnico_telegram_chat_id IS DISTINCT FROM OLD.fu_tecnico_telegram_chat_id OR
 NEW.fu_tecnico_telegram_message_id IS DISTINCT FROM OLD.fu_tecnico_telegram_message_id) THEN
 RAISE EXCEPTION 'Confirmação de envio é registrada pelo Telegram autorizado.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fu_tecnico_proteger_confirmacao() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fu_tecnico_proteger_confirmacao BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.fu_tecnico_proteger_confirmacao();

CREATE OR REPLACE FUNCTION public.fu_tecnico_confirmar_envio(p_task uuid,p_telegram_user bigint,p_chat bigint,p_message bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.tasks; l public.leads; v_user uuid; v_nome text; v_unit text;
BEGIN
 SELECT * INTO t FROM public.tasks WHERE id=p_task FOR UPDATE;
 IF t.id IS NULL OR t.fu_tecnico_etapa IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','Tarefa não encontrada.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.telegram_groups WHERE unidade_id=t.unidade_id AND group_type='coordenadores' AND status='conectado' AND telegram_chat_id=p_chat) THEN
 RETURN jsonb_build_object('ok',false,'erro','Confirmação permitida apenas no grupo COORDENADOR da unidade atual.'); END IF;
 SELECT user_id INTO v_user FROM public.telegram_users WHERE telegram_user_id=p_telegram_user AND status='conectado';
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role::text IN ('admin','gerente','coordenador')) OR
 NOT (public.has_role(v_user,'admin') OR t.unidade_id IN (SELECT public.get_user_unidades(v_user))) THEN
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
END $$;
REVOKE ALL ON FUNCTION public.fu_tecnico_confirmar_envio(uuid,bigint,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_tecnico_confirmar_envio(uuid,bigint,bigint,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.fu_tecnico_claim(p_task uuid,p_dia date) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.tasks t SET fu_tecnico_envio_dia=p_dia,fu_tecnico_envio_status='reservado',fu_tecnico_envio_erro=NULL
 WHERE t.id=p_task AND t.fu_tecnico_confirmado_em IS NULL AND t.fu_tecnico_status IN ('pendente','em_andamento') AND t.prazo<=p_dia AND (t.fu_tecnico_envio_dia IS NULL OR t.fu_tecnico_envio_dia<p_dia)
 AND EXISTS (SELECT 1 FROM public.leads l JOIN public.interacoes i ON i.id=t.fu_tecnico_matricula_id WHERE l.id=t.fu_tecnico_lead_id AND l.unidade_id=t.unidade_id AND l.ativo=true AND l.is_matriculado=true AND l.status_funil<>'perdido' AND i.fechou_matricula=true AND i.cancelado IS DISTINCT FROM true);
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.fu_tecnico_claim(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_tecnico_claim(uuid,date) TO service_role;