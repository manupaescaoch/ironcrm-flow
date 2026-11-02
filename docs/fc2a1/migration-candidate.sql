-- FC-2A.1 PREPARATION ONLY. Tested in a disposable database; NOT APPLIED TO PRODUCTION.
-- Activation and recipient configuration require a later specific approval.
CREATE TABLE public.experimental_ciclos_config (
 unidade_id uuid PRIMARY KEY REFERENCES public.unidades(id),
 ativo boolean NOT NULL DEFAULT false,
 crm_integrado boolean NOT NULL DEFAULT false,
 evochat_integrado boolean NOT NULL DEFAULT false,
 telegram_integrado boolean NOT NULL DEFAULT false,
 escritores_integrados boolean NOT NULL DEFAULT false,
 avisos_ativos boolean NOT NULL DEFAULT false,
 recepcao_usuario_id uuid,
 aprovado_em timestamptz,
 CHECK(NOT ativo OR (crm_integrado AND evochat_integrado AND telegram_integrado AND escritores_integrados AND aprovado_em IS NOT NULL)),
 CHECK(NOT avisos_ativos OR (ativo AND recepcao_usuario_id IS NOT NULL))
);
GRANT ALL ON public.experimental_ciclos_config TO service_role;
ALTER TABLE public.experimental_ciclos_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.experimental_ciclos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 interacao_id uuid NOT NULL REFERENCES public.interacoes(id),
 lead_id uuid NOT NULL REFERENCES public.leads(id),
 unidade_id uuid NOT NULL REFERENCES public.unidades(id),
 data_aula date NOT NULL,hora_aula time NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),criado_por uuid,
 origem_criacao text NOT NULL CHECK(origem_criacao IN ('crm_manual','telegram','integracao')),
 ciclo_anterior_id uuid REFERENCES public.experimental_ciclos(id),
 situacao text NOT NULL DEFAULT 'ativo' CHECK(situacao IN ('ativo','substituido','cancelado')),
 resultado text NOT NULL DEFAULT 'pendente' CHECK(resultado IN ('pendente','compareceu','nao_compareceu')),
 versao integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.experimental_ciclos TO authenticated;
GRANT ALL ON public.experimental_ciclos TO service_role;
ALTER TABLE public.experimental_ciclos ENABLE ROW LEVEL SECURITY;
CREATE POLICY experimental_ciclos_select ON public.experimental_ciclos FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR unidade_id IN (SELECT public.get_user_unidades(auth.uid())));
CREATE UNIQUE INDEX experimental_ciclos_ativo ON public.experimental_ciclos(interacao_id) WHERE situacao='ativo';

CREATE TABLE public.experimental_ciclo_eventos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ciclo_id uuid NOT NULL REFERENCES public.experimental_ciclos(id),
 interacao_id uuid NOT NULL REFERENCES public.interacoes(id),lead_id uuid NOT NULL REFERENCES public.leads(id),unidade_id uuid NOT NULL REFERENCES public.unidades(id),
 data_aula date NOT NULL,hora_aula time NOT NULL,
 tipo text NOT NULL CHECK(tipo IN ('criado','confirmado','corrigido','reagendado','cancelado')),
 resultado_anterior text,resultado_novo text,
 registrado_em timestamptz NOT NULL DEFAULT now(),origem text NOT NULL CHECK(origem IN ('crm_manual','telegram','integracao')),
 responsavel_id uuid,telegram_usuario_id bigint,telegram_controle_id uuid REFERENCES public.experimental_presenca_telegram(id),
 motivo text,chave text NOT NULL UNIQUE,versao integer NOT NULL
);
GRANT SELECT ON public.experimental_ciclo_eventos TO authenticated;
GRANT SELECT,INSERT ON public.experimental_ciclo_eventos TO service_role;
ALTER TABLE public.experimental_ciclo_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY experimental_eventos_select ON public.experimental_ciclo_eventos FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR unidade_id IN (SELECT public.get_user_unidades(auth.uid())));

CREATE TABLE public.experimental_ciclo_avisos (
 ciclo_id uuid PRIMARY KEY REFERENCES public.experimental_ciclos(id),unidade_id uuid NOT NULL REFERENCES public.unidades(id),
 usuario_id uuid,notificacao_id uuid REFERENCES public.ops_notificacoes(id),
 estado text NOT NULL DEFAULT 'bloqueado' CHECK(estado IN ('bloqueado','registrado')),
 criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.experimental_ciclo_avisos TO service_role;
ALTER TABLE public.experimental_ciclo_avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_notificacoes ADD COLUMN experimental_ciclo_id uuid REFERENCES public.experimental_ciclos(id);

-- Server-private context: PID/transaction are not secrets; privileges are the boundary.
CREATE TABLE public.experimental_ciclo_contexto (
 pid integer NOT NULL,transacao bigint NOT NULL,interacao_id uuid NOT NULL,
 PRIMARY KEY(pid,transacao,interacao_id)
);
GRANT ALL ON public.experimental_ciclo_contexto TO service_role;
ALTER TABLE public.experimental_ciclo_contexto ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.interacoes ADD COLUMN experimental_ciclo_atual_id uuid REFERENCES public.experimental_ciclos(id);
ALTER TABLE public.experimental_presenca_telegram ADD COLUMN ciclo_id uuid REFERENCES public.experimental_ciclos(id);
-- A repeated date/time after a different cycle must not reuse the previous message.
CREATE UNIQUE INDEX experimental_telegram_ciclo ON public.experimental_presenca_telegram(ciclo_id) WHERE ciclo_id IS NOT NULL;
-- Existing transport uniqueness continues for unlinked legacy messages only.
DROP INDEX public.ux_exp_presenca_slot;
CREATE UNIQUE INDEX ux_exp_presenca_slot ON public.experimental_presenca_telegram(interacao_id,data_aula,hora_aula) WHERE ciclo_id IS NULL;

-- Only traceable cycles skip legacy overwrites; unlinked rows retain the exact branch.
CREATE OR REPLACE FUNCTION public.sync_hora_experimental_from_lead() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE lead_hora time;
BEGIN
 IF NEW.experimental_ciclo_atual_id IS NOT NULL THEN RETURN NEW; END IF;
 IF NEW.data_experimental IS NOT NULL THEN
  SELECT hora_aula_experimental INTO lead_hora FROM public.leads WHERE id=NEW.lead_id;
  IF lead_hora IS NOT NULL THEN NEW.hora_experimental:=lead_hora; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.sync_interacao_unidade_from_lead() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_lead_unidade_id uuid;
BEGIN
 IF NEW.experimental_ciclo_atual_id IS NOT NULL THEN RETURN NEW; END IF;
 SELECT unidade_id INTO v_lead_unidade_id FROM public.leads WHERE id=NEW.lead_id;
 IF v_lead_unidade_id IS NOT NULL THEN NEW.unidade_id:=v_lead_unidade_id; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.experimental_contexto(p_interacao uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.experimental_ciclo_contexto WHERE pid=pg_backend_pid() AND transacao=txid_current() AND interacao_id=p_interacao)
$$;
REVOKE ALL ON FUNCTION public.experimental_contexto(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.experimental_contexto(uuid) TO service_role;

CREATE FUNCTION public.experimental_evidencia_imutavel() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'Evidência não pode ser apagada ou sobrescrita'; END $$;
CREATE TRIGGER experimental_eventos_imutaveis BEFORE UPDATE OR DELETE ON public.experimental_ciclo_eventos FOR EACH ROW EXECUTE FUNCTION public.experimental_evidencia_imutavel();
CREATE FUNCTION public.experimental_ciclo_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Cancele ou inative; evidência deve ser preservada'; END IF;
 IF NOT public.experimental_contexto(NEW.interacao_id) THEN RAISE EXCEPTION 'Operação de ciclo obrigatória'; END IF;
 IF TG_OP='UPDATE' AND (NEW.interacao_id,NEW.lead_id,NEW.unidade_id,NEW.data_aula,NEW.hora_aula,NEW.criado_em,NEW.ciclo_anterior_id) IS DISTINCT FROM (OLD.interacao_id,OLD.lead_id,OLD.unidade_id,OLD.data_aula,OLD.hora_aula,OLD.criado_em,OLD.ciclo_anterior_id) THEN RAISE EXCEPTION 'Identidade original do ciclo é imutável'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER experimental_ciclo_guard BEFORE INSERT OR UPDATE OR DELETE ON public.experimental_ciclos FOR EACH ROW EXECUTE FUNCTION public.experimental_ciclo_guard();

CREATE FUNCTION public.experimental_interacao_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' AND EXISTS(SELECT 1 FROM public.experimental_ciclos WHERE interacao_id=OLD.id) THEN RAISE EXCEPTION 'Cancele ou inative o agendamento'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF (NEW.experimental_ciclo_atual_id IS NOT NULL OR (TG_OP='UPDATE' AND OLD.experimental_ciclo_atual_id IS NOT NULL)) AND NOT public.experimental_contexto(NEW.id) AND (TG_OP='INSERT' OR (NEW.lead_id,NEW.unidade_id,NEW.data_experimental,NEW.hora_experimental,NEW.compareceu,NEW.cancelado,NEW.agendou_experimental,NEW.experimental_ciclo_atual_id) IS DISTINCT FROM (OLD.lead_id,OLD.unidade_id,OLD.data_experimental,OLD.hora_experimental,OLD.compareceu,OLD.cancelado,OLD.agendou_experimental,OLD.experimental_ciclo_atual_id)) THEN RAISE EXCEPTION 'Use operação autorizada do ciclo'; END IF;
 RETURN NEW;
END $$;
-- Final BEFORE guard sees mutations made by existing BEFORE triggers.
CREATE TRIGGER zzz_experimental_interacao_guard BEFORE INSERT OR UPDATE OR DELETE ON public.interacoes FOR EACH ROW EXECUTE FUNCTION public.experimental_interacao_guard();

CREATE FUNCTION public.experimental_assert(p_interacao uuid,p_usuario uuid,p_origem text) RETURNS public.interacoes LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.interacoes;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço obrigatório'; END IF;
 SELECT * INTO i FROM public.interacoes WHERE id=p_interacao FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.experimental_ciclos_config WHERE unidade_id=i.unidade_id AND ativo) THEN RAISE EXCEPTION 'Ciclo não habilitado'; END IF;
 IF p_origem IS NULL OR p_origem NOT IN ('crm_manual','telegram','integracao') THEN RAISE EXCEPTION 'Origem inválida'; END IF;
 IF p_origem='crm_manual' AND (p_usuario IS NULL OR NOT (public.has_role(p_usuario,'admin') OR i.unidade_id IN (SELECT public.get_user_unidades(p_usuario)))) THEN RAISE EXCEPTION 'Sem autorização para unidade'; END IF;
 RETURN i;
END $$;
REVOKE ALL ON FUNCTION public.experimental_assert(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.experimental_assert(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.experimental_evento(p_ciclo uuid,p_tipo text,p_antes text,p_depois text,p_origem text,p_usuario uuid,p_telegram bigint,p_controle uuid,p_chave text,p_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO public.experimental_ciclo_eventos(ciclo_id,interacao_id,lead_id,unidade_id,data_aula,hora_aula,tipo,resultado_anterior,resultado_novo,origem,responsavel_id,telegram_usuario_id,telegram_controle_id,chave,motivo,versao)
 SELECT id,interacao_id,lead_id,unidade_id,data_aula,hora_aula,p_tipo,p_antes,p_depois,p_origem,p_usuario,p_telegram,p_controle,p_chave,p_motivo,versao FROM public.experimental_ciclos WHERE id=p_ciclo;
END $$;
REVOKE ALL ON FUNCTION public.experimental_evento(uuid,text,text,text,text,uuid,bigint,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.experimental_evento(uuid,text,text,text,text,uuid,bigint,uuid,text,text) TO service_role;

-- Prospective adoption only: no result copied from compareceu; intended for a NEW slot.
CREATE FUNCTION public.experimental_novo_ciclo(p_interacao uuid,p_data date,p_hora time,p_usuario uuid,p_origem text,p_chave text,p_anterior uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.interacoes;c uuid;e public.experimental_ciclo_eventos;
BEGIN
 i:=public.experimental_assert(p_interacao,p_usuario,p_origem);
 IF p_data IS NULL OR p_hora IS NULL OR p_chave IS NULL OR length(p_chave) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Slot/chave inválidos'; END IF;
 SELECT * INTO e FROM public.experimental_ciclo_eventos WHERE chave=p_chave;
 IF FOUND THEN IF e.interacao_id<>i.id OR e.tipo<>'criado' OR e.data_aula<>p_data OR e.hora_aula<>p_hora THEN RAISE EXCEPTION 'Chave reutilizada'; END IF; RETURN e.ciclo_id; END IF;
 IF EXISTS(SELECT 1 FROM public.experimental_ciclos WHERE interacao_id=i.id AND situacao='ativo') THEN RAISE EXCEPTION 'Ciclo ativo existente'; END IF;
 IF p_anterior IS NULL AND i.created_at<(SELECT aprovado_em FROM public.experimental_ciclos_config WHERE unidade_id=i.unidade_id) THEN RAISE EXCEPTION 'Interação histórica: não converter nem reconstruir ciclos'; END IF;
 IF p_anterior IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.experimental_ciclos WHERE id=p_anterior AND interacao_id=i.id AND lead_id=i.lead_id AND unidade_id=i.unidade_id AND situacao='substituido') THEN RAISE EXCEPTION 'Predecessor inválido'; END IF;
 INSERT INTO public.experimental_ciclo_contexto VALUES(pg_backend_pid(),txid_current(),i.id) ON CONFLICT DO NOTHING;
 INSERT INTO public.experimental_ciclos(interacao_id,lead_id,unidade_id,data_aula,hora_aula,criado_por,origem_criacao,ciclo_anterior_id) VALUES(i.id,i.lead_id,i.unidade_id,p_data,p_hora,p_usuario,p_origem,p_anterior) RETURNING id INTO c;
 UPDATE public.interacoes SET experimental_ciclo_atual_id=c,data_experimental=p_data,hora_experimental=p_hora,compareceu=NULL,agendou_experimental=true,cancelado=false,cancelado_em=NULL,confirmado=false WHERE id=i.id;
 PERFORM public.experimental_evento(c,'criado',NULL,'pendente',p_origem,p_usuario,NULL,NULL,p_chave,NULL);
 DELETE FROM public.experimental_ciclo_contexto WHERE pid=pg_backend_pid() AND transacao=txid_current() AND interacao_id=i.id;
 RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.experimental_novo_ciclo(uuid,date,time,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.experimental_novo_ciclo(uuid,date,time,uuid,text,text,uuid) TO service_role;

CREATE FUNCTION public.experimental_confirmar(p_ciclo uuid,p_resultado text,p_usuario uuid,p_origem text,p_chave text,p_versao integer,p_motivo text DEFAULT NULL,p_controle uuid DEFAULT NULL,p_chat bigint DEFAULT NULL,p_mensagem bigint DEFAULT NULL,p_telegram bigint DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.experimental_ciclos;i public.interacoes;e public.experimental_ciclo_eventos;m public.experimental_presenca_telegram;cfg public.experimental_ciclos_config;n uuid;
BEGIN
 SELECT interacao_id INTO n FROM public.experimental_ciclos WHERE id=p_ciclo;
 i:=public.experimental_assert(n,p_usuario,p_origem);
 SELECT * INTO c FROM public.experimental_ciclos WHERE id=p_ciclo FOR UPDATE;
 IF c.situacao<>'ativo' OR i.experimental_ciclo_atual_id IS DISTINCT FROM c.id OR i.lead_id<>c.lead_id OR i.unidade_id<>c.unidade_id OR i.data_experimental<>c.data_aula OR i.hora_experimental<>c.hora_aula OR i.cancelado THEN RAISE EXCEPTION 'Agendamento anterior ou vínculo divergente'; END IF;
 IF p_resultado NOT IN ('compareceu','nao_compareceu') OR p_resultado IS NULL OR p_chave IS NULL OR p_versao IS NULL OR length(p_chave) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Resultado/chave inválidos'; END IF;
 IF p_origem='telegram' THEN
  SELECT * INTO m FROM public.experimental_presenca_telegram WHERE id=p_controle FOR UPDATE;
  IF NOT FOUND OR m.ciclo_id IS DISTINCT FROM c.id OR m.interacao_id<>i.id OR m.lead_id<>c.lead_id OR m.unidade_id<>c.unidade_id OR m.data_aula<>c.data_aula OR m.hora_aula::time<>c.hora_aula OR m.telegram_chat_id IS DISTINCT FROM p_chat OR m.telegram_message_id IS DISTINCT FROM p_mensagem OR p_telegram IS NULL OR NOT EXISTS(SELECT 1 FROM public.telegram_groups WHERE unidade_id=c.unidade_id AND telegram_chat_id=p_chat AND group_type='comercial' AND status='conectado') THEN RAISE EXCEPTION 'Mensagem/grupo/ciclo inválidos'; END IF;
 END IF;
 SELECT * INTO e FROM public.experimental_ciclo_eventos WHERE chave=p_chave;
 IF FOUND THEN IF e.ciclo_id<>c.id OR e.resultado_novo<>p_resultado THEN RAISE EXCEPTION 'Chave reutilizada'; END IF; RETURN jsonb_build_object('ok',true,'repetido',true,'ciclo_id',c.id); END IF;
 IF c.resultado=p_resultado THEN RETURN jsonb_build_object('ok',true,'repetido',true,'ciclo_id',c.id); END IF;
 IF c.versao<>p_versao THEN RAISE EXCEPTION 'Confirmação concorrente; atualize a tela'; END IF;
 IF c.resultado<>'pendente' AND (p_origem<>'crm_manual' OR length(trim(coalesce(p_motivo,'')))<1) THEN RAISE EXCEPTION 'Correção manual com motivo obrigatória'; END IF;
 IF p_origem='telegram' AND m.status<>'enviado' THEN RAISE EXCEPTION 'Mensagem já respondida'; END IF;
 INSERT INTO public.experimental_ciclo_contexto VALUES(pg_backend_pid(),txid_current(),i.id) ON CONFLICT DO NOTHING;
 UPDATE public.experimental_ciclos SET resultado=p_resultado,versao=versao+1 WHERE id=c.id;
 PERFORM public.experimental_evento(c.id,CASE WHEN c.resultado='pendente' THEN 'confirmado' ELSE 'corrigido' END,c.resultado,p_resultado,p_origem,p_usuario,p_telegram,p_controle,p_chave,p_motivo);
 UPDATE public.interacoes SET compareceu=(p_resultado='compareceu') WHERE id=i.id;
 IF p_origem='telegram' THEN UPDATE public.experimental_presenca_telegram SET status='respondido',resultado=p_resultado,origem_resposta='telegram',respondido_por=p_telegram::text,respondido_em=now(),updated_at=now() WHERE id=m.id; END IF;
 IF p_resultado='nao_compareceu' THEN
  INSERT INTO public.experimental_ciclo_avisos(ciclo_id,unidade_id) VALUES(c.id,c.unidade_id) ON CONFLICT DO NOTHING;
  SELECT * INTO cfg FROM public.experimental_ciclos_config WHERE unidade_id=c.unidade_id;
  IF cfg.avisos_ativos AND cfg.recepcao_usuario_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_unidades WHERE user_id=cfg.recepcao_usuario_id AND unidade_id=c.unidade_id) AND EXISTS(SELECT 1 FROM public.cronograma_funcionarios WHERE user_id=cfg.recepcao_usuario_id AND unidade_id=c.unidade_id AND ativo AND lower(setor) IN ('recepcao','recepção')) THEN
   SELECT notificacao_id INTO n FROM public.experimental_ciclo_avisos WHERE ciclo_id=c.id FOR UPDATE;
   IF n IS NULL THEN INSERT INTO public.ops_notificacoes(usuario_id,tipo,titulo,mensagem,experimental_ciclo_id) VALUES(cfg.recepcao_usuario_id,'experimental_reagendamento','Experimental: reagendamento necessário','Não comparecimento explicitamente confirmado. Aula '||to_char(c.data_aula,'DD/MM/YYYY')||' às '||to_char(c.hora_aula,'HH24:MI')||'. Consulte o agendamento da sua unidade.',c.id) RETURNING id INTO n;
    UPDATE public.experimental_ciclo_avisos SET usuario_id=cfg.recepcao_usuario_id,notificacao_id=n,estado='registrado' WHERE ciclo_id=c.id;
   END IF;
  END IF;
 END IF;
 DELETE FROM public.experimental_ciclo_contexto WHERE pid=pg_backend_pid() AND transacao=txid_current() AND interacao_id=i.id;
 RETURN jsonb_build_object('ok',true,'repetido',false,'ciclo_id',c.id,'resultado',p_resultado);
END $$;
REVOKE ALL ON FUNCTION public.experimental_confirmar(uuid,text,uuid,text,text,integer,text,uuid,bigint,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.experimental_confirmar(uuid,text,uuid,text,text,integer,text,uuid,bigint,bigint,bigint) TO service_role;

CREATE FUNCTION public.experimental_encerrar(p_ciclo uuid,p_usuario uuid,p_origem text,p_chave text,p_motivo text,p_nova_data date DEFAULT NULL,p_nova_hora time DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.experimental_ciclos;i public.interacoes;novo uuid;e public.experimental_ciclo_eventos;
BEGIN
 SELECT interacao_id INTO novo FROM public.experimental_ciclos WHERE id=p_ciclo;
 i:=public.experimental_assert(novo,p_usuario,p_origem);
 SELECT * INTO c FROM public.experimental_ciclos WHERE id=p_ciclo FOR UPDATE;
 SELECT * INTO e FROM public.experimental_ciclo_eventos WHERE chave=p_chave;
 IF FOUND THEN IF e.ciclo_id<>c.id THEN RAISE EXCEPTION 'Chave reutilizada'; END IF; SELECT id INTO novo FROM public.experimental_ciclos WHERE ciclo_anterior_id=c.id; RETURN coalesce(novo,c.id); END IF;
 IF c.situacao<>'ativo' OR i.experimental_ciclo_atual_id IS DISTINCT FROM c.id OR c.unidade_id<>i.unidade_id OR c.lead_id<>i.lead_id THEN RAISE EXCEPTION 'Ciclo anterior'; END IF;
 IF p_chave IS NULL OR length(p_chave) NOT BETWEEN 1 AND 195 OR length(trim(coalesce(p_motivo,'')))=0 OR (p_nova_data IS NULL)<>(p_nova_hora IS NULL) THEN RAISE EXCEPTION 'Motivo/novo slot inválidos'; END IF;
 INSERT INTO public.experimental_ciclo_contexto VALUES(pg_backend_pid(),txid_current(),i.id) ON CONFLICT DO NOTHING;
 UPDATE public.experimental_ciclos SET situacao=CASE WHEN p_nova_data IS NULL THEN 'cancelado' ELSE 'substituido' END,versao=versao+1 WHERE id=c.id;
 PERFORM public.experimental_evento(c.id,CASE WHEN p_nova_data IS NULL THEN 'cancelado' ELSE 'reagendado' END,c.resultado,c.resultado,p_origem,p_usuario,NULL,NULL,p_chave,p_motivo);
 IF p_nova_data IS NOT NULL THEN
  novo:=public.experimental_novo_ciclo(i.id,p_nova_data,p_nova_hora,p_usuario,p_origem,p_chave||':novo',c.id);
 ELSE
  UPDATE public.interacoes SET cancelado=true,cancelado_em=now(),motivo_cancelamento=p_motivo,agendou_experimental=false WHERE id=i.id;
  novo:=c.id;
 END IF;
 DELETE FROM public.experimental_ciclo_contexto WHERE pid=pg_backend_pid() AND transacao=txid_current() AND interacao_id=i.id;
 RETURN novo;
END $$;
REVOKE ALL ON FUNCTION public.experimental_encerrar(uuid,uuid,text,text,text,date,time) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.experimental_encerrar(uuid,uuid,text,text,text,date,time) TO service_role;