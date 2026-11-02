ALTER TABLE public.tasks
 ADD COLUMN fu_matriculados_lead_id uuid REFERENCES public.leads(id),
 ADD COLUMN fu_matriculados_matricula_id uuid REFERENCES public.interacoes(id),
 ADD COLUMN fu_matriculados_envio_dia date,
 ADD COLUMN fu_matriculados_envio_erro text,
 ADD COLUMN fu_matriculados_chat_id bigint,
 ADD COLUMN fu_matriculados_message_id bigint,
 ADD COLUMN fu_matriculados_confirmado_em timestamptz,
 ADD COLUMN fu_matriculados_confirmado_por uuid,
 ADD COLUMN fu_matriculados_confirmado_nome text;
CREATE UNIQUE INDEX tasks_fu_matriculados_ciclo ON public.tasks(fu_matriculados_matricula_id) WHERE fu_matriculados_matricula_id IS NOT NULL;
CREATE FUNCTION public.fu_matriculados_inicio() RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$ SELECT '2026-11-02T11:18:39Z'::timestamptz $$;
REVOKE ALL ON FUNCTION public.fu_matriculados_inicio() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fu_matriculados_inicio() TO authenticated,service_role;
CREATE FUNCTION public.fu_matriculados_proteger() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.fu_matriculados_matricula_id IS NOT NULL THEN RAISE EXCEPTION 'FU Matriculados possui histórico; não exclua.'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.fu_matriculados_matricula_id IS NOT NULL AND (NEW.fu_matriculados_matricula_id IS DISTINCT FROM OLD.fu_matriculados_matricula_id OR NEW.fu_matriculados_lead_id IS DISTINCT FROM OLD.fu_matriculados_lead_id) THEN RAISE EXCEPTION 'Identidade imutável.'; END IF;
 IF NEW.fu_matriculados_matricula_id IS NULL THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL AND pg_trigger_depth()=1 THEN
  IF TG_OP='INSERT' THEN RAISE EXCEPTION 'FU criado somente pela matrícula.'; END IF;
  IF (SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(NEW)) WHERE key LIKE 'fu_matriculados_%') IS DISTINCT FROM (SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(OLD)) WHERE key LIKE 'fu_matriculados_%') OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id THEN RAISE EXCEPTION 'Envio controlado pelo Telegram autorizado.'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status='concluida' AND OLD.fu_matriculados_confirmado_em IS NULL THEN RAISE EXCEPTION 'Confirme o envio antes de concluir o acompanhamento.'; END IF;
 END IF;
 NEW.notificado_24h:=true; NEW.notificado_prazo:=true; NEW.recorrencia:=NULL; NEW.recorrencia_fim:=NULL;
 RETURN NEW;
END $$;
CREATE TRIGGER aaa_fu_matriculados_proteger BEFORE INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.fu_matriculados_proteger();
CREATE FUNCTION public.fu_matriculados_nova_matricula() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l public.leads; v_task uuid;
BEGIN
 IF NEW.cancelado=true OR NEW.fechou_matricula IS DISTINCT FROM true THEN
  UPDATE public.tasks SET status='concluida',fu_matriculados_envio_erro='Matrícula cancelada' WHERE fu_matriculados_matricula_id=NEW.id AND fu_matriculados_confirmado_em IS NULL;
  RETURN NEW;
 END IF;
 IF NEW.data_fechamento IS NULL OR NEW.created_at<public.fu_matriculados_inicio() OR NEW.data_fechamento<(public.fu_matriculados_inicio() AT TIME ZONE 'America/Recife')::date THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.fechou_matricula=true AND OLD.data_fechamento IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO l FROM public.leads WHERE id=NEW.lead_id;
 -- Existing active enrollment denotes continuation/renewal, not a new welcome.
 IF l.ativo IS DISTINCT FROM true OR l.unidade_id IS DISTINCT FROM NEW.unidade_id OR upper(coalesce(l.origem,'')) LIKE '%IMPORT%' OR upper(coalesce(NEW.tipo,'')) LIKE '%RENOVA%' OR EXISTS(SELECT 1 FROM public.interacoes WHERE lead_id=l.id AND unidade_id=l.unidade_id AND id<>NEW.id AND fechou_matricula=true AND cancelado IS DISTINCT FROM true) THEN RETURN NEW; END IF;
 INSERT INTO public.tasks(titulo,descricao,responsavel,setor,prioridade,prazo,unidade_id,fu_matriculados_lead_id,fu_matriculados_matricula_id,notificado_24h,notificado_prazo)
 VALUES('FU | MATRICULADOS | '||l.nome,'BOAS-VINDAS MANUAL PELO COMERCIAL. CONFIRMAR ENVIO NO TELEGRAM; ACOMPANHAMENTO SEPARADO.','[COMERCIAL]','COMERCIAL','media',public.fu_next_weekday((now() AT TIME ZONE 'America/Recife')::date),l.unidade_id,l.id,NEW.id,true,true)
 ON CONFLICT DO NOTHING RETURNING id INTO v_task;
 IF v_task IS NOT NULL THEN
  BEGIN
   PERFORM net.http_post(url:='https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/notify-boas-vindas-matricula',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',public.get_cron_secret()),body:=jsonb_build_object('task_id',v_task));
  EXCEPTION WHEN OTHERS THEN NULL; END;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fu_matriculados_matricula AFTER INSERT OR UPDATE OF fechou_matricula,cancelado,data_fechamento ON public.interacoes FOR EACH ROW EXECUTE FUNCTION public.fu_matriculados_nova_matricula();
CREATE FUNCTION public.fu_matriculados_sincronizar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.tasks SET unidade_id=NEW.unidade_id, status=CASE WHEN NEW.ativo IS DISTINCT FROM true OR NEW.is_matriculado IS DISTINCT FROM true OR NEW.status_funil='perdido' THEN 'concluida' ELSE status END,
 fu_matriculados_envio_erro=CASE WHEN NEW.ativo IS DISTINCT FROM true OR NEW.is_matriculado IS DISTINCT FROM true OR NEW.status_funil='perdido' THEN 'Aluno ou matrícula inativo' ELSE fu_matriculados_envio_erro END,
 fu_matriculados_chat_id=CASE WHEN NEW.unidade_id IS DISTINCT FROM OLD.unidade_id THEN NULL ELSE fu_matriculados_chat_id END,
 fu_matriculados_message_id=CASE WHEN NEW.unidade_id IS DISTINCT FROM OLD.unidade_id THEN NULL ELSE fu_matriculados_message_id END
 WHERE fu_matriculados_lead_id=NEW.id AND fu_matriculados_confirmado_em IS NULL AND status<>'concluida';
 RETURN NEW;
END $$;
CREATE TRIGGER fu_matriculados_aluno AFTER UPDATE OF unidade_id,ativo,is_matriculado,status_funil ON public.leads FOR EACH ROW EXECUTE FUNCTION public.fu_matriculados_sincronizar();
CREATE FUNCTION public.fu_matriculados_claim(p_task uuid,p_dia date) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.tasks t SET fu_matriculados_envio_dia=p_dia,fu_matriculados_envio_erro=NULL
 WHERE t.id=p_task AND t.fu_matriculados_matricula_id IS NOT NULL AND t.fu_matriculados_confirmado_em IS NULL AND t.status<>'concluida' AND t.prazo<=p_dia AND p_dia=(now() AT TIME ZONE 'America/Recife')::date AND extract(isodow FROM p_dia)<6 AND (t.fu_matriculados_envio_dia IS NULL OR t.fu_matriculados_envio_dia<p_dia)
 AND EXISTS(SELECT 1 FROM public.leads l JOIN public.interacoes i ON i.id=t.fu_matriculados_matricula_id WHERE l.id=t.fu_matriculados_lead_id AND l.unidade_id=t.unidade_id AND l.ativo=true AND l.is_matriculado=true AND l.pausado_fu IS DISTINCT FROM true AND i.fechou_matricula=true AND i.cancelado IS DISTINCT FROM true);
 RETURN FOUND;
END $$;
CREATE FUNCTION public.fu_matriculados_confirmar_envio(p_task uuid,p_telegram_user bigint,p_chat bigint,p_message bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.tasks; l public.leads; v_user uuid; v_nome text; v_unit text;
BEGIN
 SELECT * INTO t FROM public.tasks WHERE id=p_task FOR UPDATE;
 IF t.fu_matriculados_matricula_id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','FU não encontrado.'); END IF;
 SELECT user_id INTO v_user FROM public.telegram_users WHERE telegram_user_id=p_telegram_user AND status='conectado';
 IF v_user IS NULL OR NOT (public.has_role(v_user,'admin') OR (public.has_role(v_user,'user') AND t.unidade_id IN (SELECT public.get_user_unidades(v_user)))) THEN RETURN jsonb_build_object('ok',false,'erro','Vincule seu Telegram a um usuário Comercial autorizado da unidade.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.telegram_groups WHERE unidade_id=t.unidade_id AND group_type='comercial' AND status='conectado' AND telegram_chat_id=p_chat) OR t.fu_matriculados_chat_id IS DISTINCT FROM p_chat OR t.fu_matriculados_message_id IS DISTINCT FROM p_message THEN RETURN jsonb_build_object('ok',false,'erro','Aviso inválido ou substituído; utilize o COMERCIAL da unidade atual.'); END IF;
 SELECT * INTO l FROM public.leads WHERE id=t.fu_matriculados_lead_id;
 IF l.ativo IS DISTINCT FROM true OR l.is_matriculado IS DISTINCT FROM true OR l.unidade_id IS DISTINCT FROM t.unidade_id OR NOT EXISTS(SELECT 1 FROM public.interacoes WHERE id=t.fu_matriculados_matricula_id AND fechou_matricula=true AND cancelado IS DISTINCT FROM true) THEN RETURN jsonb_build_object('ok',false,'erro','Matrícula inativa.'); END IF;
 SELECT nome INTO v_unit FROM public.unidades WHERE id=t.unidade_id;
 IF t.fu_matriculados_confirmado_em IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'duplicado',true,'confirmado_em',t.fu_matriculados_confirmado_em,'responsavel',t.fu_matriculados_confirmado_nome,'unidade',v_unit,'aluno',l.nome); END IF;
 IF t.status='concluida' THEN RETURN jsonb_build_object('ok',false,'erro','Acompanhamento encerrado.'); END IF;
 SELECT nome INTO v_nome FROM public.cronograma_funcionarios WHERE user_id=v_user AND unidade_id=t.unidade_id AND ativo=true ORDER BY id LIMIT 1;
 v_nome:=coalesce(v_nome,(SELECT nullif(trim(concat_ws(' ',telegram_first_name,telegram_last_name)),'') FROM public.telegram_users WHERE user_id=v_user),'COMERCIAL');
 UPDATE public.tasks SET fu_matriculados_confirmado_em=now(),fu_matriculados_confirmado_por=v_user,fu_matriculados_confirmado_nome=v_nome WHERE id=t.id;
 UPDATE public.interacoes SET boas_vindas_enviada_em=now() WHERE id=t.fu_matriculados_matricula_id;
 INSERT INTO public.task_history(task_id,user_id,user_name,campo,valor_anterior,valor_novo) VALUES(t.id,v_user,v_nome,'fu_matriculados_envio_aluno','pendente',jsonb_build_object('status','enviado','confirmado_em',now(),'telegram_user_id',p_telegram_user)::text);
 RETURN jsonb_build_object('ok',true,'duplicado',false,'confirmado_em',now(),'responsavel',v_nome,'unidade',v_unit,'aluno',l.nome);
END $$;
REVOKE ALL ON FUNCTION public.fu_matriculados_claim(uuid,date),public.fu_matriculados_confirmar_envio(uuid,bigint,bigint,bigint),public.fu_matriculados_proteger(),public.fu_matriculados_nova_matricula(),public.fu_matriculados_sincronizar() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_matriculados_claim(uuid,date),public.fu_matriculados_confirmar_envio(uuid,bigint,bigint,bigint) TO service_role;
