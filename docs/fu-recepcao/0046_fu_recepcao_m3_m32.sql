-- Recepção M+3/M+32: reuses the FU Matriculados task identity with an explicit stage; only enrollments created after activation.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS fu_matriculados_etapa text NOT NULL DEFAULT 'BV';
ALTER TABLE public.tasks ADD CONSTRAINT tasks_fu_matriculados_etapa_check CHECK (fu_matriculados_etapa IN ('BV','M+3','M+32'));
DROP INDEX IF EXISTS public.tasks_fu_matriculados_ciclo;
CREATE UNIQUE INDEX tasks_fu_matriculados_ciclo ON public.tasks(fu_matriculados_matricula_id, fu_matriculados_etapa) WHERE fu_matriculados_matricula_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fu_recepcao_inicio() RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$ SELECT '2026-11-02T18:50:00Z'::timestamptz $$;
REVOKE ALL ON FUNCTION public.fu_recepcao_inicio() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fu_recepcao_inicio() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.fu_matriculados_nova_matricula()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE l public.leads; v_task uuid; n int;
BEGIN
 IF NEW.cancelado=true OR NEW.fechou_matricula IS DISTINCT FROM true THEN
  UPDATE public.tasks SET status='concluida',fu_matriculados_envio_erro='Matrícula cancelada' WHERE fu_matriculados_matricula_id=NEW.id AND fu_matriculados_confirmado_em IS NULL;
  RETURN NEW;
 END IF;
 IF NEW.data_fechamento IS NULL OR NEW.created_at<public.fu_matriculados_inicio() OR NEW.data_fechamento<(public.fu_matriculados_inicio() AT TIME ZONE 'America/Recife')::date THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.fechou_matricula=true AND OLD.data_fechamento IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO l FROM public.leads WHERE id=NEW.lead_id;
 IF l.ativo IS DISTINCT FROM true OR l.unidade_id IS DISTINCT FROM NEW.unidade_id OR upper(coalesce(l.origem,'')) LIKE '%IMPORT%' OR upper(coalesce(NEW.tipo,'')) LIKE '%RENOVA%' OR EXISTS(SELECT 1 FROM public.interacoes WHERE lead_id=l.id AND unidade_id=l.unidade_id AND id<>NEW.id AND fechou_matricula=true AND cancelado IS DISTINCT FROM true) THEN RETURN NEW; END IF;
 INSERT INTO public.tasks(titulo,descricao,responsavel,setor,prioridade,prazo,unidade_id,fu_matriculados_lead_id,fu_matriculados_matricula_id,fu_matriculados_etapa,notificado_24h,notificado_prazo)
 VALUES('FU | MATRICULADOS | '||l.nome,'BOAS-VINDAS MANUAL PELO COMERCIAL. CONFIRMAR ENVIO NO TELEGRAM; ACOMPANHAMENTO SEPARADO.','[COMERCIAL]','COMERCIAL','media',public.fu_next_weekday((now() AT TIME ZONE 'America/Recife')::date),l.unidade_id,l.id,NEW.id,'BV',true,true)
 ON CONFLICT DO NOTHING RETURNING id INTO v_task;
 IF NEW.created_at>=public.fu_recepcao_inicio() THEN
  FOREACH n IN ARRAY ARRAY[3,32] LOOP
   INSERT INTO public.tasks(titulo,descricao,responsavel,setor,prioridade,prazo,unidade_id,fu_matriculados_lead_id,fu_matriculados_matricula_id,fu_matriculados_etapa,notificado_24h,notificado_prazo)
   VALUES('FU | RECEPÇÃO | M+'||n||' | '||l.nome,'CONTATO MANUAL DA RECEPÇÃO. CONFIRMAR ENVIO NO TELEGRAM; ACOMPANHAMENTO SEPARADO.','[RECEPÇÃO]','COMERCIAL','media',public.fu_next_weekday(NEW.data_fechamento+n),l.unidade_id,l.id,NEW.id,'M+'||n,true,true)
   ON CONFLICT DO NOTHING;
  END LOOP;
 END IF;
 IF v_task IS NOT NULL THEN
  BEGIN
   PERFORM net.http_post(url:='https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/notify-boas-vindas-matricula',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',public.get_cron_secret()),body:=jsonb_build_object('task_id',v_task));
  EXCEPTION WHEN OTHERS THEN NULL; END;
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.fu_matriculados_confirmar_envio(p_task uuid,p_telegram_user bigint,p_chat bigint,p_message bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.tasks; l public.leads; v_user uuid; v_nome text; v_unit text;
BEGIN
 SELECT * INTO t FROM public.tasks WHERE id=p_task FOR UPDATE;
 IF t.fu_matriculados_matricula_id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','FU não encontrado.'); END IF;
 SELECT user_id INTO v_user FROM public.telegram_users WHERE telegram_user_id=p_telegram_user AND status='conectado';
 IF v_user IS NULL OR NOT (public.has_role(v_user,'admin') OR (public.has_role(v_user,'user') AND t.unidade_id IN (SELECT public.get_user_unidades(v_user)))) THEN RETURN jsonb_build_object('ok',false,'erro','Vincule seu Telegram a um usuário autorizado da unidade.'); END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.fu_matriculados_confirmar_envio(uuid,bigint,bigint,bigint),public.fu_matriculados_nova_matricula() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_matriculados_confirmar_envio(uuid,bigint,bigint,bigint) TO service_role;

-- D+30 automático desativado: novos registros D+30 não são criados; histórico preservado.
CREATE OR REPLACE FUNCTION public.fu_d30_desativado() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.tipo='D+30' THEN RETURN NULL; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fu_d30_desativado() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER aaa_fu_d30_desativado BEFORE INSERT ON public.follow_ups FOR EACH ROW EXECUTE FUNCTION public.fu_d30_desativado();
