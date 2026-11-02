-- Fase 1: somente eventos de matrícula posteriores à instalação. Sem backfill.
ALTER TABLE public.tasks
 ADD COLUMN fu_gerencial_lead_id uuid REFERENCES public.leads(id),
 ADD COLUMN fu_gerencial_matricula_id uuid REFERENCES public.interacoes(id),
 ADD COLUMN fu_gerencial_etapa text CHECK (fu_gerencial_etapa IN ('M+30')),
 ADD COLUMN fu_gerencial_status text CHECK (fu_gerencial_status IN ('pendente','em_andamento','concluido','dispensado','cancelado')),
 ADD COLUMN fu_gerencial_registro jsonb,
 ADD COLUMN fu_gerencial_envio_dia date,
 ADD COLUMN fu_gerencial_envio_status text,
 ADD COLUMN fu_gerencial_envio_erro text,
 ADD COLUMN fu_gerencial_contexto jsonb,
 ADD COLUMN fu_gerencial_concluido_em timestamptz;
-- The immutable creation time of this function is the deployment cutoff; no data seed is needed.
CREATE FUNCTION public.fu_gerencial_inicio() RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$ SELECT '2026-11-02T10:55:15Z'::timestamptz $$;
REVOKE ALL ON FUNCTION public.fu_gerencial_inicio() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fu_gerencial_inicio() TO authenticated,service_role;
CREATE UNIQUE INDEX tasks_fu_gerencial_ciclo ON public.tasks(fu_gerencial_lead_id,fu_gerencial_matricula_id,fu_gerencial_etapa) WHERE fu_gerencial_etapa IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fu_gerencial_validar_tarefa() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r jsonb; v_user text;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.fu_gerencial_etapa IS NOT NULL THEN RAISE EXCEPTION 'FU gerencial possui histórico; cancele ou dispense, não exclua.'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.fu_gerencial_etapa IS NOT NULL AND
  (NEW.fu_gerencial_lead_id IS DISTINCT FROM OLD.fu_gerencial_lead_id OR NEW.fu_gerencial_matricula_id IS DISTINCT FROM OLD.fu_gerencial_matricula_id OR NEW.fu_gerencial_etapa IS DISTINCT FROM OLD.fu_gerencial_etapa) THEN
  RAISE EXCEPTION 'Identidade do acompanhamento não pode ser alterada.';
 END IF;
 IF NEW.fu_gerencial_etapa IS NULL THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL AND pg_trigger_depth()=1 THEN
  IF TG_OP='INSERT' THEN RAISE EXCEPTION 'FU gerencial é criado pela matrícula.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','gerente')) OR
   NOT (public.has_role(auth.uid(),'admin') OR NEW.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))) THEN
   RAISE EXCEPTION 'Somente o gerente ou administrador da unidade pode registrar o FU gerencial.';
  END IF;
  IF NEW.unidade_id IS DISTINCT FROM OLD.unidade_id OR NEW.fu_gerencial_envio_dia IS DISTINCT FROM OLD.fu_gerencial_envio_dia OR NEW.fu_gerencial_envio_status IS DISTINCT FROM OLD.fu_gerencial_envio_status OR NEW.fu_gerencial_envio_erro IS DISTINCT FROM OLD.fu_gerencial_envio_erro OR NEW.fu_gerencial_contexto IS DISTINCT FROM OLD.fu_gerencial_contexto THEN
   RAISE EXCEPTION 'Unidade e envio são controlados pelo sistema.';
  END IF;
  IF OLD.fu_gerencial_status IN ('concluido','dispensado','cancelado') THEN RAISE EXCEPTION 'Acompanhamento encerrado; histórico preservado.'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.fu_gerencial_status IS NOT DISTINCT FROM OLD.fu_gerencial_status THEN
   IF NEW.status='concluida' THEN NEW.fu_gerencial_status='concluido';
   ELSIF NEW.status='em_andamento' THEN NEW.fu_gerencial_status='em_andamento';
   ELSE NEW.fu_gerencial_status='pendente'; END IF;
  END IF;
 END IF;
 IF NEW.fu_gerencial_status IN ('concluido','dispensado') OR (NEW.fu_gerencial_status='cancelado' AND auth.uid() IS NOT NULL AND pg_trigger_depth()=1) THEN
  r:=NEW.fu_gerencial_registro;
  IF r IS NULL OR coalesce(r->>'data','') !~ '^\d{4}-\d{2}-\d{2}$' OR nullif(trim(r->>'gerente'),'') IS NULL OR
   coalesce(r->>'canal','') NOT IN ('presencial','whatsapp') OR nullif(trim(r->>'percepcao'),'') IS NULL THEN
   RAISE EXCEPTION 'Registre data, gerente, canal e percepção antes de encerrar.';
  END IF;
  IF (r->>'data')::date > (now() AT TIME ZONE 'America/Recife')::date THEN RAISE EXCEPTION 'Data de acompanhamento não pode ser futura.'; END IF;
 END IF;
 NEW.status:=CASE WHEN NEW.fu_gerencial_status IN ('concluido','dispensado','cancelado') THEN 'concluida' WHEN NEW.fu_gerencial_status='em_andamento' THEN 'em_andamento' ELSE 'a_fazer' END;
 NEW.recorrencia:=NULL; NEW.recorrencia_fim:=NULL;
 NEW.notificado_24h:=true; NEW.notificado_prazo:=true;
 NEW.fu_gerencial_concluido_em:=CASE WHEN NEW.fu_gerencial_status IN ('concluido','dispensado','cancelado') THEN coalesce(OLD.fu_gerencial_concluido_em,now()) ELSE NULL END;
 IF TG_OP='UPDATE' AND (NEW.fu_gerencial_status IS DISTINCT FROM OLD.fu_gerencial_status OR NEW.fu_gerencial_registro IS DISTINCT FROM OLD.fu_gerencial_registro OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id) THEN
  v_user:=coalesce(NEW.fu_gerencial_registro->>'gerente','SISTEMA');
  INSERT INTO public.task_history(task_id,user_id,user_name,campo,valor_anterior,valor_novo)
   VALUES(NEW.id,auth.uid(),coalesce(v_user,'SISTEMA'),'acompanhamento_gerencial',jsonb_build_object('status',OLD.fu_gerencial_status,'registro',OLD.fu_gerencial_registro,'unidade',OLD.unidade_id)::text,jsonb_build_object('status',NEW.fu_gerencial_status,'registro',NEW.fu_gerencial_registro,'unidade',NEW.unidade_id)::text);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aaa_fu_gerencial_validar BEFORE INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.fu_gerencial_validar_tarefa();

CREATE OR REPLACE FUNCTION public.fu_gerencial_nova_matricula() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l public.leads; n integer;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.cancelado=true OR NEW.fechou_matricula IS DISTINCT FROM true) THEN
  UPDATE public.tasks SET fu_gerencial_status='cancelado',fu_gerencial_envio_erro='Matrícula cancelada' WHERE fu_gerencial_matricula_id=NEW.id AND fu_gerencial_status IN ('pendente','em_andamento');
 END IF;
 IF NEW.fechou_matricula IS DISTINCT FROM true OR NEW.data_fechamento IS NULL OR NEW.cancelado=true OR NEW.created_at < public.fu_gerencial_inicio() OR NEW.data_fechamento < (public.fu_gerencial_inicio() AT TIME ZONE 'America/Recife')::date THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.fechou_matricula=true AND OLD.data_fechamento IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO l FROM public.leads WHERE id=NEW.lead_id;
 IF l.ativo IS DISTINCT FROM true OR l.unidade_id IS NULL THEN RETURN NEW; END IF;
 UPDATE public.tasks SET fu_gerencial_status='cancelado',fu_gerencial_envio_erro='Novo ciclo de matrícula' WHERE fu_gerencial_lead_id=l.id AND fu_gerencial_matricula_id<>NEW.id AND fu_gerencial_status IN ('pendente','em_andamento');
 -- No auth-derived grants are widened: creation is performed by this event trigger.
 FOR n IN SELECT unnest(ARRAY[30]) LOOP
  INSERT INTO public.tasks(titulo,descricao,responsavel,setor,prioridade,prazo,unidade_id,fu_gerencial_lead_id,fu_gerencial_matricula_id,fu_gerencial_etapa,fu_gerencial_status,notificado_24h,notificado_prazo)
  VALUES('ACOMPANHAMENTO GERENCIAL | M+'||n||' | '||l.nome,
   'CONSULTAR HISTÓRICO ANTES DO CONTATO. VERIFICAR EXPERIÊNCIA, RECLAMAÇÕES E PROVIDÊNCIAS. NÃO REPETIR PERGUNTAS JÁ RESPONDIDAS.',
   '[GERENTE]','GERENCIA','media',public.fu_next_weekday(NEW.data_fechamento+n),l.unidade_id,l.id,NEW.id,'M+'||n,'pendente',true,true)
  ON CONFLICT DO NOTHING;
 END LOOP;
 RETURN NEW;
END $$;
-- Trigger-generated inserts bypass only the technical INSERT prohibition via trigger depth.
CREATE TRIGGER fu_gerencial_matricula AFTER INSERT OR UPDATE OF fechou_matricula,cancelado,data_fechamento ON public.interacoes FOR EACH ROW EXECUTE FUNCTION public.fu_gerencial_nova_matricula();

CREATE OR REPLACE FUNCTION public.fu_gerencial_sincronizar_aluno() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.tasks SET unidade_id=NEW.unidade_id,
  fu_gerencial_status=CASE WHEN NEW.ativo IS DISTINCT FROM true OR NEW.is_matriculado IS DISTINCT FROM true OR NEW.status_funil='perdido' THEN 'cancelado' ELSE fu_gerencial_status END,
  fu_gerencial_envio_erro=CASE WHEN NEW.ativo IS DISTINCT FROM true OR NEW.is_matriculado IS DISTINCT FROM true OR NEW.status_funil='perdido' THEN 'Aluno inativo ou matrícula cancelada' ELSE fu_gerencial_envio_erro END
 WHERE fu_gerencial_lead_id=NEW.id AND fu_gerencial_status IN ('pendente','em_andamento');
 RETURN NEW;
END $$;
CREATE TRIGGER fu_gerencial_aluno AFTER UPDATE OF unidade_id,ativo,is_matriculado,status_funil ON public.leads FOR EACH ROW EXECUTE FUNCTION public.fu_gerencial_sincronizar_aluno();

ALTER TABLE public.tasks
 ADD COLUMN fu_gerencial_confirmado_em timestamptz,
 ADD COLUMN fu_gerencial_confirmado_por uuid,
 ADD COLUMN fu_gerencial_confirmado_telegram_id bigint,
 ADD COLUMN fu_gerencial_confirmado_nome text,
 ADD COLUMN fu_gerencial_telegram_chat_id bigint,
 ADD COLUMN fu_gerencial_telegram_message_id bigint;

CREATE OR REPLACE FUNCTION public.fu_gerencial_proteger_confirmacao() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND pg_trigger_depth()=1 AND (
 NEW.fu_gerencial_confirmado_em IS DISTINCT FROM OLD.fu_gerencial_confirmado_em OR
 NEW.fu_gerencial_confirmado_por IS DISTINCT FROM OLD.fu_gerencial_confirmado_por OR
 NEW.fu_gerencial_confirmado_telegram_id IS DISTINCT FROM OLD.fu_gerencial_confirmado_telegram_id OR
 NEW.fu_gerencial_confirmado_nome IS DISTINCT FROM OLD.fu_gerencial_confirmado_nome OR
 NEW.fu_gerencial_telegram_chat_id IS DISTINCT FROM OLD.fu_gerencial_telegram_chat_id OR
 NEW.fu_gerencial_telegram_message_id IS DISTINCT FROM OLD.fu_gerencial_telegram_message_id) THEN
 RAISE EXCEPTION 'Confirmação de envio é registrada pelo Telegram autorizado.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fu_gerencial_proteger_confirmacao() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fu_gerencial_proteger_confirmacao BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.fu_gerencial_proteger_confirmacao();

CREATE OR REPLACE FUNCTION public.fu_gerencial_confirmar_envio(p_task uuid,p_telegram_user bigint,p_chat bigint,p_message bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.tasks; l public.leads; v_user uuid; v_nome text; v_unit text;
BEGIN
 SELECT * INTO t FROM public.tasks WHERE id=p_task FOR UPDATE;
 IF t.id IS NULL OR t.fu_gerencial_etapa IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','Tarefa não encontrada.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.telegram_groups WHERE unidade_id=t.unidade_id AND group_type='gerencia' AND status='conectado' AND telegram_chat_id=p_chat) THEN
 RETURN jsonb_build_object('ok',false,'erro','Confirmação permitida apenas no grupo GERENTE da unidade atual.'); END IF;
 SELECT user_id INTO v_user FROM public.telegram_users WHERE telegram_user_id=p_telegram_user AND status='conectado';
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_user AND role::text IN ('admin','gerente')) OR
 NOT (public.has_role(v_user,'admin') OR t.unidade_id IN (SELECT public.get_user_unidades(v_user))) THEN
 RETURN jsonb_build_object('ok',false,'erro','Seu Telegram precisa estar vinculado a um usuário autorizado da unidade.'); END IF;
 IF t.fu_gerencial_telegram_chat_id IS DISTINCT FROM p_chat OR t.fu_gerencial_telegram_message_id IS DISTINCT FROM p_message THEN
 RETURN jsonb_build_object('ok',false,'erro','Este aviso foi substituído ou pertence a outra tarefa.'); END IF;
 SELECT * INTO l FROM public.leads WHERE id=t.fu_gerencial_lead_id;
 IF t.fu_gerencial_status IN ('concluido','dispensado','cancelado') OR l.ativo IS DISTINCT FROM true OR l.is_matriculado IS DISTINCT FROM true OR l.unidade_id IS DISTINCT FROM t.unidade_id OR l.status_funil='perdido' OR
 NOT EXISTS(SELECT 1 FROM public.interacoes WHERE id=t.fu_gerencial_matricula_id AND fechou_matricula=true AND cancelado IS DISTINCT FROM true) THEN
 RETURN jsonb_build_object('ok',false,'erro','Acompanhamento encerrado ou matrícula inativa.'); END IF;
 SELECT nome INTO v_nome FROM public.cronograma_funcionarios WHERE user_id=v_user AND unidade_id=t.unidade_id AND ativo=true ORDER BY id LIMIT 1;
 v_nome:=coalesce(nullif(trim(v_nome),''),(SELECT nullif(trim(concat_ws(' ',telegram_first_name,telegram_last_name)),'') FROM public.telegram_users WHERE user_id=v_user),'GERENTE');
 SELECT nome INTO v_unit FROM public.unidades WHERE id=t.unidade_id;
 IF t.fu_gerencial_confirmado_em IS NOT NULL THEN
 RETURN jsonb_build_object('ok',true,'duplicado',true,'confirmado_em',t.fu_gerencial_confirmado_em,'responsavel',t.fu_gerencial_confirmado_nome,'unidade',v_unit,'aluno',l.nome,'etapa',t.fu_gerencial_etapa); END IF;
 UPDATE public.tasks SET fu_gerencial_confirmado_em=now(),fu_gerencial_confirmado_por=v_user,fu_gerencial_confirmado_telegram_id=p_telegram_user,fu_gerencial_confirmado_nome=v_nome WHERE id=t.id;
 INSERT INTO public.task_history(task_id,user_id,user_name,campo,valor_anterior,valor_novo)
 VALUES(t.id,v_user,v_nome,'fu_gerencial_envio_aluno','pendente',jsonb_build_object('status','enviado','confirmado_em',now(),'telegram_user_id',p_telegram_user)::text);
 RETURN jsonb_build_object('ok',true,'duplicado',false,'confirmado_em',now(),'responsavel',v_nome,'unidade',v_unit,'aluno',l.nome,'etapa',t.fu_gerencial_etapa);
END $$;
REVOKE ALL ON FUNCTION public.fu_gerencial_confirmar_envio(uuid,bigint,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_gerencial_confirmar_envio(uuid,bigint,bigint,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.fu_gerencial_claim(p_task uuid,p_dia date) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.tasks t SET fu_gerencial_envio_dia=p_dia,fu_gerencial_envio_status='reservado',fu_gerencial_envio_erro=NULL
 WHERE t.id=p_task AND t.fu_gerencial_confirmado_em IS NULL AND t.fu_gerencial_status IN ('pendente','em_andamento') AND t.prazo<=p_dia AND extract(isodow FROM p_dia)<6 AND (t.fu_gerencial_envio_dia IS NULL OR t.fu_gerencial_envio_dia<p_dia)
 AND EXISTS (SELECT 1 FROM public.leads l JOIN public.interacoes i ON i.id=t.fu_gerencial_matricula_id WHERE l.id=t.fu_gerencial_lead_id AND l.unidade_id=t.unidade_id AND l.ativo=true AND l.is_matriculado=true AND l.status_funil<>'perdido' AND i.fechou_matricula=true AND i.cancelado IS DISTINCT FROM true);
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.fu_gerencial_claim(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_gerencial_claim(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.fu_gerencial_validar_tarefa(),public.fu_gerencial_nova_matricula(),public.fu_gerencial_sincronizar_aluno() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.fu_gerencial_contexto(p_task uuid,p_agora timestamptz DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.tasks; l public.leads; i public.interacoes; v_unit text; v_last timestamptz; v_until timestamptz;
 v_day date:=(p_agora AT TIME ZONE 'America/Recife')::date; v_avisos text[]:=ARRAY[]::text[]; v_motivo text; v_done boolean;
BEGIN
 SELECT * INTO t FROM public.tasks WHERE id=p_task;
 SELECT * INTO l FROM public.leads WHERE id=t.fu_gerencial_lead_id;
 SELECT * INTO i FROM public.interacoes WHERE id=t.fu_gerencial_matricula_id;
 IF t.fu_gerencial_etapa IS NULL OR l.ativo IS DISTINCT FROM true OR l.is_matriculado IS DISTINCT FROM true OR l.unidade_id IS DISTINCT FROM t.unidade_id OR l.status_funil='perdido' OR i.fechou_matricula IS DISTINCT FROM true OR i.cancelado=true OR t.fu_gerencial_status NOT IN ('pendente','em_andamento') THEN RETURN jsonb_build_object('elegivel',false); END IF;
 SELECT nome INTO v_unit FROM public.unidades WHERE id=t.unidade_id;
 SELECT EXISTS(SELECT 1 FROM public.follow_ups WHERE lead_id=l.id AND unidade_id=t.unidade_id AND tipo='G+30' AND status='concluido' AND (data_referencia AT TIME ZONE 'America/Recife')::date>=i.data_fechamento) INTO v_done;
 IF v_done THEN v_avisos:=array_append(v_avisos,'Objetivo já realizado no FU gerencial anterior: conferir o histórico e dispensar este acompanhamento.'); END IF;
 SELECT max(at) INTO v_last FROM (
  SELECT created_at AS at FROM public.whatsapp_envios_log WHERE unidade_id=t.unidade_id AND tipo_destino='lead' AND sucesso=true AND public.canonical_phone(destino)=public.canonical_phone(l.telefone)
  UNION ALL SELECT received_at FROM public.whatsapp_messages WHERE lead_id=l.id AND unidade_id=t.unidade_id AND direction IN ('outbound','out','sent')
  UNION ALL SELECT concluido_em FROM public.follow_ups WHERE lead_id=l.id AND unidade_id=t.unidade_id AND status='concluido'
  UNION ALL SELECT greatest(fu_tecnico_confirmado_em, CASE WHEN fu_tecnico_status='concluido' THEN ((fu_tecnico_registro->>'data')::date + time '23:59') AT TIME ZONE 'America/Recife' END) FROM public.tasks WHERE fu_tecnico_lead_id=l.id AND unidade_id=t.unidade_id
  UNION ALL SELECT greatest(fu_gerencial_confirmado_em,fu_gerencial_concluido_em) FROM public.tasks WHERE fu_gerencial_lead_id=l.id AND unidade_id=t.unidade_id AND id<>t.id AND fu_gerencial_status<>'cancelado'
  UNION ALL SELECT created_at FROM public.nps_respostas WHERE lead_id=l.id AND unidade_id=t.unidade_id
 ) contacts WHERE at<=p_agora;
 IF v_last > p_agora - interval '72 hours' THEN
  v_until:=v_last + interval '72 hours'; v_motivo:='Contato ou resposta recente: respeitar intervalo mínimo de 72 horas e não repetir perguntas.';
  v_avisos:=array_append(v_avisos,v_motivo);
 END IF;
 IF EXISTS(SELECT 1 FROM public.follow_ups WHERE lead_id=l.id AND unidade_id=t.unidade_id AND status='pendente' AND tipo NOT IN ('G+7','G+30') AND (data_prevista AT TIME ZONE 'America/Recife')::date=v_day)
 OR EXISTS(SELECT 1 FROM public.tasks WHERE fu_tecnico_lead_id=l.id AND unidade_id=t.unidade_id AND fu_tecnico_status IN ('pendente','em_andamento') AND fu_tecnico_confirmado_em IS NULL AND prazo=v_day) THEN
  v_until:=greatest(v_until,p_agora + interval '24 hours'); v_motivo:='Outro contato programado no mesmo dia: reagendar somente o FU gerencial.';
  v_avisos:=array_append(v_avisos,v_motivo);
 END IF;
 IF EXISTS(SELECT 1 FROM public.whatsapp_conversations WHERE lead_id=l.id AND unidade_id=t.unidade_id AND status_conversa NOT IN ('concluida','resolvida','fechada','closed')) THEN
  v_avisos:=array_append(v_avisos,'Conversa em andamento: consultar mensagens antes de iniciar um novo contato.');
 END IF;
 IF EXISTS(SELECT 1 FROM public.nps_respostas WHERE lead_id=l.id AND unidade_id=t.unidade_id AND nota_nps<=6 AND status NOT IN ('resolvido','concluido','encerrado')) THEN
  v_avisos:=array_append(v_avisos,'PRIORIDADE: reclamação ou insatisfação NPS aberta. Tratar a pendência sem repetir perguntas.');
 END IF;
 -- Day-only historical contact records are conservatively held until the next weekday after expiry.
 RETURN jsonb_build_object('elegivel',true,'aluno',l.nome,'telefone',l.telefone,'unidade',v_unit,'objetivo_realizado',v_done,'avisos',to_jsonb(v_avisos),'ultimo_contato',v_last,'motivo',v_motivo,'adiar_ate',CASE WHEN v_until IS NOT NULL THEN public.fu_next_weekday((v_until AT TIME ZONE 'America/Recife')::date+1)::text END);
END $$;
REVOKE ALL ON FUNCTION public.fu_gerencial_contexto(uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_gerencial_contexto(uuid,timestamptz) TO service_role;