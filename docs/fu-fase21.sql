-- Preserve the existing lead/type uniqueness, including ON CONFLICT callers.
-- REAG holds an append-only event ledger for each experimental slot.
ALTER TABLE public.follow_ups ADD COLUMN reag_eventos jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.follow_ups DROP CONSTRAINT follow_ups_tipo_check;
ALTER TABLE public.follow_ups ADD CONSTRAINT follow_ups_tipo_check CHECK (tipo IN ('D+1','D+7','D+15','D+30','M+7','M+30','G+7','G+30','REAG'));

CREATE OR REPLACE FUNCTION public.fu_reag_reservar(p_lead uuid,p_interacao uuid,p_chave text,p_responsavel text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l public.leads; i public.interacoes; f public.follow_ups; expected text;
BEGIN
  SELECT * INTO l FROM public.leads WHERE id=p_lead FOR UPDATE;
  SELECT * INTO i FROM public.interacoes WHERE id=p_interacao FOR UPDATE;
  IF l.id IS NULL OR i.id IS NULL OR i.lead_id<>l.id OR i.unidade_id<>l.unidade_id THEN RAISE EXCEPTION 'Experimental indisponível'; END IF;
  IF l.ativo IS NOT TRUE OR l.is_matriculado IS TRUE OR l.pausado_fu IS TRUE OR l.status_funil IN ('perdido','convertido')
    OR i.compareceu IS DISTINCT FROM false OR i.cancelado IS TRUE OR i.agendou_experimental IS NOT TRUE
    OR i.data_experimental IS NULL OR i.hora_experimental IS NULL
    OR l.data_aula_experimental IS DISTINCT FROM i.data_experimental OR l.hora_aula_experimental IS DISTINCT FROM i.hora_experimental
    OR (i.data_experimental+i.hora_experimental) AT TIME ZONE 'America/Recife'>now() THEN RAISE EXCEPTION 'Experimental não elegível'; END IF;
  expected := 'send-reagendamento-experimental:'||l.id||':'||i.data_experimental||':'||to_char(i.hora_experimental,'HH24:MI');
  IF p_chave IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Identidade do evento inválida'; END IF;
  INSERT INTO public.follow_ups(lead_id,unidade_id,tipo,data_referencia,data_prevista,status)
  VALUES(l.id,l.unidade_id,'REAG',now(),now(),'enviando') ON CONFLICT(lead_id,tipo) DO NOTHING;
  SELECT * INTO f FROM public.follow_ups WHERE lead_id=l.id AND tipo='REAG' FOR UPDATE;
  IF f.reag_eventos ? p_chave THEN RETURN jsonb_build_object('id',f.id,'claimed',false); END IF;
  UPDATE public.follow_ups SET unidade_id=l.unidade_id,status='enviando',data_referencia=now(),data_prevista=now(),
    concluido_em=NULL,concluido_por=NULL,updated_at=now(),
    reag_eventos=reag_eventos||jsonb_build_object(p_chave,jsonb_build_object('interacao_id',i.id,'lead_id',l.id,'unidade_id',l.unidade_id,
    'data',i.data_experimental,'hora',i.hora_experimental,'estado','reservado','responsavel',p_responsavel,'reservado_em',now())) WHERE id=f.id;
  RETURN jsonb_build_object('id',f.id,'claimed',true);
END $$;
REVOKE ALL ON FUNCTION public.fu_reag_reservar(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_reag_reservar(uuid,uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fu_reag_finalizar(p_id uuid,p_chave text,p_estado text,p_status integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public.follow_ups; event jsonb;
BEGIN
  IF p_estado NOT IN ('enviado','ambiguo','falha_pre_envio','reconciliacao') THEN RAISE EXCEPTION 'Resultado inválido'; END IF;
  SELECT * INTO f FROM public.follow_ups WHERE id=p_id AND tipo='REAG' FOR UPDATE;
  event := f.reag_eventos->p_chave;
  IF event IS NULL THEN RAISE EXCEPTION 'Reserva não encontrada'; END IF;
  IF event->>'estado'<>'reservado' THEN RETURN; END IF;
  event := event||jsonb_build_object('estado',p_estado,'status_provedor',p_status,'resultado_em',now());
  UPDATE public.follow_ups SET reag_eventos=jsonb_set(reag_eventos,ARRAY[p_chave],event),
    status=CASE WHEN p_estado='enviado' THEN 'concluido' ELSE 'enviando' END,
    concluido_em=CASE WHEN p_estado='enviado' THEN now() ELSE NULL END,
    concluido_por=CASE WHEN p_estado='enviado' THEN event->>'responsavel' ELSE NULL END,updated_at=now() WHERE id=p_id;
  INSERT INTO public.interacoes(lead_id,unidade_id,tipo,descricao,data_interacao,atendido_por)
  VALUES(f.lead_id,(event->>'unidade_id')::uuid,'whatsapp',
    'FU Reagendamento: '||p_estado||' | experimental '||(event->>'interacao_id')||' | evento '||p_chave,
    now(),event->>'responsavel');
END $$;
REVOKE ALL ON FUNCTION public.fu_reag_finalizar(uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_reag_finalizar(uuid,text,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.fu_reag_proteger_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF current_user NOT IN ('postgres','service_role','supabase_admin') AND
    ((TG_OP='INSERT' AND NEW.reag_eventos<>'{}'::jsonb) OR (TG_OP='UPDATE' AND NEW.reag_eventos IS DISTINCT FROM OLD.reag_eventos))
  THEN RAISE EXCEPTION 'Registro de envio restrito ao serviço'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fu_reag_proteger_ledger BEFORE INSERT OR UPDATE ON public.follow_ups FOR EACH ROW EXECUTE FUNCTION public.fu_reag_proteger_ledger();