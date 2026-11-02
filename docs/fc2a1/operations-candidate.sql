-- PREPARATION ONLY: apply after migration-candidate.sql in disposable database.
CREATE UNIQUE INDEX experimental_successor_unique ON public.experimental_ciclos(ciclo_anterior_id) WHERE ciclo_anterior_id IS NOT NULL;
CREATE UNIQUE INDEX experimental_notice_unique ON public.ops_notificacoes(experimental_ciclo_id) WHERE experimental_ciclo_id IS NOT NULL;

-- Preserve legacy inverse synchronization, but do not rewrite evidence-backed slots.
CREATE OR REPLACE FUNCTION public.sync_interacoes_hora_from_lead() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.hora_aula_experimental IS DISTINCT FROM OLD.hora_aula_experimental THEN
  UPDATE public.interacoes SET hora_experimental=NEW.hora_aula_experimental
  WHERE lead_id=NEW.id AND data_experimental>=CURRENT_DATE AND experimental_ciclo_atual_id IS NULL
  AND hora_experimental IS DISTINCT FROM NEW.hora_aula_experimental;
 END IF;RETURN NEW;
END $$;

CREATE TABLE public.experimental_comandos (
 chave text PRIMARY KEY,usuario_id uuid NOT NULL,unidade_id uuid NOT NULL REFERENCES public.unidades(id),
 comando jsonb NOT NULL,resposta jsonb NOT NULL,criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.experimental_comandos TO service_role;
ALTER TABLE public.experimental_comandos ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.experimental_operar(p_usuario uuid,p_comando jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE op text:=p_comando->>'operacao';u uuid:=(p_comando->>'unidade_id')::uuid;k text:=p_comando->>'chave';
 l public.leads;i public.interacoes;c public.experimental_ciclos;prev public.experimental_comandos;
 target_id uuid;result jsonb;v integer;d date;h time;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço obrigatório';END IF;
 IF p_usuario IS NULL OR NOT(public.has_role(p_usuario,'admin') OR u IN(SELECT public.get_user_unidades(p_usuario))) THEN RAISE EXCEPTION 'Sem acesso à unidade';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.experimental_ciclos_config WHERE unidade_id=u AND ativo) THEN RAISE EXCEPTION 'Preparação inativa';END IF;
 IF k IS NULL OR length(k) NOT BETWEEN 1 AND 190 OR op IS NULL OR op NOT IN('criar','editar','confirmar','cancelar','inativar','reagendar') THEN RAISE EXCEPTION 'Comando inválido';END IF;
 -- Serialize equal intents before any write; payload/actor collisions cannot return false success.
 PERFORM pg_advisory_xact_lock(hashtextextended(k,0));
 SELECT * INTO prev FROM public.experimental_comandos WHERE chave=k;
 IF FOUND THEN
  IF prev.usuario_id<>p_usuario OR prev.unidade_id<>u OR prev.comando<>p_comando THEN RAISE EXCEPTION 'Chave reutilizada com outro comando';END IF;
  RETURN prev.resposta||jsonb_build_object('repetido',true);
 END IF;
 IF op='criar' THEN
  IF p_comando-ARRAY['operacao','unidade_id','chave','lead_id','data','hora','descricao']<>'{}'::jsonb THEN RAISE EXCEPTION 'Campos inválidos';END IF;
  SELECT * INTO l FROM public.leads WHERE id=(p_comando->>'lead_id')::uuid FOR UPDATE;
  IF NOT FOUND OR l.unidade_id<>u THEN RAISE EXCEPTION 'Lead de outra unidade';END IF;
  d:=(p_comando->>'data')::date;h:=(p_comando->>'hora')::time;
  IF d IS NULL OR h IS NULL THEN RAISE EXCEPTION 'Slot obrigatório';END IF;
  UPDATE public.leads SET data_aula_experimental=(d+h) AT TIME ZONE 'America/Recife',hora_aula_experimental=h WHERE id=l.id;
  INSERT INTO public.interacoes(lead_id,unidade_id,created_by,agendou_experimental,data_experimental,hora_experimental,compareceu,descricao)
  VALUES(l.id,u,p_usuario,true,d,h,NULL,p_comando->>'descricao') RETURNING * INTO i;
  target_id:=public.experimental_novo_ciclo(i.id,d,h,p_usuario,'crm_manual',k||':ciclo');
 ELSE
  SELECT * INTO c FROM public.experimental_ciclos WHERE id=(p_comando->>'ciclo_id')::uuid;
  IF NOT FOUND OR c.unidade_id<>u THEN RAISE EXCEPTION 'Ciclo de outra unidade';END IF;
  -- Every orchestrated path uses lead -> interaction -> cycle lock order.
  SELECT * INTO l FROM public.leads WHERE id=c.lead_id FOR UPDATE;
  i:=public.experimental_assert(c.interacao_id,p_usuario,'crm_manual');
  SELECT * INTO c FROM public.experimental_ciclos WHERE id=c.id FOR UPDATE;
  v:=(p_comando->>'versao')::integer;
  IF v IS NULL OR v<>c.versao OR c.situacao<>'ativo' OR i.experimental_ciclo_atual_id IS DISTINCT FROM c.id THEN RAISE EXCEPTION 'Estado desatualizado';END IF;
  target_id:=c.id;
  IF op='editar' THEN
   IF p_comando-ARRAY['operacao','unidade_id','chave','ciclo_id','versao','descricao','treinador']<>'{}'::jsonb OR NOT(p_comando?'descricao' OR p_comando?'treinador') THEN RAISE EXCEPTION 'Campos inválidos';END IF;
   UPDATE public.interacoes SET descricao=CASE WHEN p_comando?'descricao' THEN p_comando->>'descricao' ELSE descricao END,
    treinador_experimental=CASE WHEN p_comando?'treinador' THEN upper(p_comando->>'treinador') ELSE treinador_experimental END WHERE id=i.id;
   INSERT INTO public.experimental_ciclo_contexto VALUES(pg_backend_pid(),txid_current(),i.id);
   UPDATE public.experimental_ciclos SET versao=versao+1 WHERE id=c.id;
   DELETE FROM public.experimental_ciclo_contexto WHERE pid=pg_backend_pid() AND transacao=txid_current() AND interacao_id=i.id;
  ELSIF op='confirmar' THEN
   IF p_comando-ARRAY['operacao','unidade_id','chave','ciclo_id','versao','resultado','motivo','treinador']<>'{}'::jsonb THEN RAISE EXCEPTION 'Campos inválidos';END IF;
   IF p_comando->>'resultado'='compareceu' AND length(trim(coalesce(p_comando->>'treinador',i.treinador_experimental,'')))=0 THEN RAISE EXCEPTION 'Treinador obrigatório';END IF;
   IF p_comando?'treinador' THEN UPDATE public.interacoes SET treinador_experimental=upper(p_comando->>'treinador') WHERE id=i.id;END IF;
   result:=public.experimental_confirmar(c.id,p_comando->>'resultado',p_usuario,'crm_manual',k||':resultado',v,p_comando->>'motivo');
  ELSE
   IF p_comando-ARRAY['operacao','unidade_id','chave','ciclo_id','versao','motivo','data','hora']<>'{}'::jsonb THEN RAISE EXCEPTION 'Campos inválidos';END IF;
   IF i.fechou_matricula THEN RAISE EXCEPTION 'Agendamento com matrícula requer revisão; não cancelar matrícula indiretamente';END IF;
   IF op='reagendar' THEN
    d:=(p_comando->>'data')::date;h:=(p_comando->>'hora')::time;
    IF d IS NULL OR h IS NULL THEN RAISE EXCEPTION 'Novo slot obrigatório';END IF;
    UPDATE public.leads SET data_aula_experimental=(d+h) AT TIME ZONE 'America/Recife',hora_aula_experimental=h WHERE id=l.id;
   END IF;
   target_id:=public.experimental_encerrar(c.id,p_usuario,'crm_manual',k||':encerrar',p_comando->>'motivo',d,h);
  END IF;
 END IF;
 SELECT versao INTO v FROM public.experimental_ciclos WHERE experimental_ciclos.id=target_id;
 result:=jsonb_build_object('ok',true,'ciclo_id',target_id,'interacao_id',i.id,'versao',v,'repetido',false);
 INSERT INTO public.experimental_comandos(chave,usuario_id,unidade_id,comando,resposta) VALUES(k,p_usuario,u,p_comando,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.experimental_operar(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.experimental_operar(uuid,jsonb) TO service_role;

-- No late notification after correction/cancellation/rebooking. A previously delivered notice stays evidence.
CREATE FUNCTION public.experimental_recuperar_aviso(p_ciclo uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.experimental_ciclo_avisos;c public.experimental_ciclos;cfg public.experimental_ciclos_config;n uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço obrigatório';END IF;
 SELECT * INTO c FROM public.experimental_ciclos WHERE id=p_ciclo FOR UPDATE;
 SELECT * INTO a FROM public.experimental_ciclo_avisos WHERE ciclo_id=p_ciclo FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF a.notificacao_id IS NOT NULL THEN RETURN a.notificacao_id;END IF;
 IF c.resultado<>'nao_compareceu' OR c.situacao<>'ativo' THEN RETURN NULL;END IF;
 SELECT * INTO cfg FROM public.experimental_ciclos_config WHERE unidade_id=c.unidade_id;
 IF NOT cfg.ativo OR NOT cfg.avisos_ativos OR cfg.recepcao_usuario_id IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.user_unidades WHERE user_id=cfg.recepcao_usuario_id AND unidade_id=c.unidade_id)
 OR NOT EXISTS(SELECT 1 FROM public.cronograma_funcionarios WHERE user_id=cfg.recepcao_usuario_id AND unidade_id=c.unidade_id AND ativo AND lower(setor) IN('recepcao','recepção')) THEN RETURN NULL;END IF;
 INSERT INTO public.ops_notificacoes(usuario_id,tipo,titulo,mensagem,experimental_ciclo_id)
 VALUES(cfg.recepcao_usuario_id,'experimental_reagendamento','Experimental: reagendamento necessário','Não comparecimento confirmado; consulte o agendamento da sua unidade.',c.id) RETURNING id INTO n;
 UPDATE public.experimental_ciclo_avisos SET usuario_id=cfg.recepcao_usuario_id,notificacao_id=n,estado='registrado' WHERE ciclo_id=c.id;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.experimental_recuperar_aviso(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.experimental_recuperar_aviso(uuid) TO service_role;