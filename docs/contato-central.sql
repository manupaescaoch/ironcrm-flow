-- Minimal execution/observation ledger: existing tasks and interactions remain the sources.
CREATE TABLE public.contato_execucoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lead_id uuid NOT NULL REFERENCES public.leads(id),
 unidade_id uuid NOT NULL REFERENCES public.unidades(id),
 ciclo_id uuid,
 chave text NOT NULL UNIQUE,
 fluxo text NOT NULL,
 objetivo text NOT NULL,
 tipo_fu text,
 setor text NOT NULL,
 canal text NOT NULL CHECK(canal IN ('whatsapp','presencial','telefone','outro')),
 telefone_normalizado text,
 responsavel text,
 prioridade integer NOT NULL CHECK(prioridade BETWEEN 1 AND 4),
 nao_urgente boolean NOT NULL DEFAULT true,
 excecao text,
 estado text NOT NULL CHECK(estado IN ('pendente','adiado','reservado','enviado','incerto','concluido','cancelado')),
 modo text NOT NULL CHECK(modo IN ('observacao','ativo')) DEFAULT 'observacao',
 prazo_original timestamptz,
 adiado_em timestamptz,
 proxima_tentativa timestamptz,
 reservado_em timestamptz,
 enviado_em timestamptz,
 acompanhamento_concluido_em timestamptz,
 motivo text,
 resultado text,
 evidencias jsonb NOT NULL DEFAULT '[]',
 observacoes jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contato_execucoes TO authenticated;
GRANT ALL ON public.contato_execucoes TO service_role;
ALTER TABLE public.contato_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY contato_historico_aluno ON public.contato_execucoes FOR SELECT TO authenticated USING (
 public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.leads l WHERE l.id=lead_id AND l.unidade_id IN(SELECT public.get_user_unidades(auth.uid())))
);
CREATE INDEX contato_aluno_tempo ON public.contato_execucoes(lead_id,enviado_em DESC);
CREATE INDEX contato_tentativa ON public.contato_execucoes(proxima_tentativa) WHERE estado='adiado';
ALTER TABLE public.interacoes ADD COLUMN contato_meta jsonb;

-- Absent settings always mean observation. Only service-role callers can invoke mutations.
CREATE FUNCTION public.contato_modo(p_fluxo text,p_unidade uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN (SELECT valor::jsonb->'fluxos'->p_fluxo->>p_unidade::text FROM public.app_config WHERE chave='contato_central_config')='ativo' THEN 'ativo' ELSE 'observacao' END
$$;
REVOKE ALL ON FUNCTION public.contato_modo(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contato_modo(text,uuid) TO service_role;

-- Stable lead UUID survives transfers. Unit is evidence-at-time, never phone identity.
-- Legacy evidence is read in place, not copied or mutated. Unknown provenance stays excluded.
CREATE FUNCTION public.contato_evidencias(p_lead uuid) RETURNS TABLE(chave text,at timestamptz,excecao text,objetivo text,ciclo_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT e.chave,e.enviado_em,e.excecao,e.objetivo,e.ciclo_id FROM public.contato_execucoes e WHERE e.lead_id=p_lead AND e.enviado_em IS NOT NULL
 UNION ALL
 SELECT 'interacao:'||i.id,i.data_interacao,coalesce(i.contato_meta->>'excecao',NULL),coalesce(i.contato_meta->>'objetivo','contato_manual'),NULL::uuid
 FROM public.interacoes i WHERE i.lead_id=p_lead AND i.data_interacao<=now()
 AND i.created_by IS NOT NULL AND i.agendou_experimental IS DISTINCT FROM true AND i.fechou_matricula IS DISTINCT FROM true
 AND ((i.contato_meta->>'estado'='enviado') OR (i.contato_meta IS NULL AND lower(trim(i.tipo)) IN ('whatsapp','presencial','pessoalmente','ligação','follow up','follow_up') AND nullif(trim(i.descricao),'') IS NOT NULL AND i.descricao !~* '(falha|erro|não enviado|nao enviado|notificação|notificacao|grupo|agendamento)'))
 AND NOT EXISTS(SELECT 1 FROM public.contato_execucoes e WHERE e.chave='interacao:'||i.id)
 UNION ALL
 SELECT 'fu:'||f.id,f.concluido_em,NULL,CASE WHEN f.tipo LIKE 'G+%' THEN 'experiencia' ELSE 'conversao' END,NULL::uuid
 FROM public.follow_ups f WHERE f.lead_id=p_lead AND f.status='concluido' AND f.concluido_em IS NOT NULL AND f.tipo<>'REAG'
 AND coalesce(f.concluido_por,'') !~* '(duplicidade|reagendado|feedback|cancelado)' AND NOT EXISTS(SELECT 1 FROM public.contato_execucoes e WHERE e.chave LIKE '%:'||f.id||':%' AND e.enviado_em IS NOT NULL)
 UNION ALL
 SELECT 'tecnico:'||t.id,t.fu_tecnico_confirmado_em,NULL,'tecnico',t.fu_tecnico_matricula_id FROM public.tasks t WHERE t.fu_tecnico_lead_id=p_lead AND t.fu_tecnico_confirmado_em IS NOT NULL
 UNION ALL
 SELECT 'registro-tecnico:'||t.id,((t.fu_tecnico_registro->>'data')::date+time '23:59:59') AT TIME ZONE 'America/Recife',NULL,'tecnico',t.fu_tecnico_matricula_id FROM public.tasks t WHERE t.fu_tecnico_lead_id=p_lead AND t.fu_tecnico_status='concluido' AND t.fu_tecnico_registro->>'data' ~ '^\d{4}-\d{2}-\d{2}$' AND t.fu_tecnico_registro->>'canal' IN ('presencial','whatsapp')
 UNION ALL
 SELECT 'gerencial:'||t.id,t.fu_gerencial_confirmado_em,NULL,'experiencia',t.fu_gerencial_matricula_id FROM public.tasks t WHERE t.fu_gerencial_lead_id=p_lead AND t.fu_gerencial_confirmado_em IS NOT NULL
 UNION ALL
 SELECT 'registro-gerencial:'||t.id,((t.fu_gerencial_registro->>'data')::date+time '23:59:59') AT TIME ZONE 'America/Recife',NULL,'experiencia',t.fu_gerencial_matricula_id FROM public.tasks t WHERE t.fu_gerencial_lead_id=p_lead AND t.fu_gerencial_status='concluido' AND t.fu_gerencial_registro->>'data' ~ '^\d{4}-\d{2}-\d{2}$' AND t.fu_gerencial_registro->>'canal' IN ('presencial','whatsapp')
 UNION ALL
 SELECT 'matriculados:'||t.id,t.fu_matriculados_confirmado_em,'transicao_matricula','boas_vindas',t.fu_matriculados_matricula_id FROM public.tasks t WHERE t.fu_matriculados_lead_id=p_lead AND t.fu_matriculados_confirmado_em IS NOT NULL

$$;
REVOKE ALL ON FUNCTION public.contato_evidencias(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contato_evidencias(uuid) TO service_role;

CREATE FUNCTION public.contato_avaliar(p_lead uuid,p_objetivo text,p_ciclo uuid,p_prioridade integer,p_nao_urgente boolean,p_excecao text,p_chave text,p_agora timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE next_at timestamptz; reason text; recent timestamptz; ids jsonb; pending_at timestamptz;
BEGIN
 IF p_excecao IS NOT NULL THEN RETURN jsonb_build_object('elegivel',true,'motivo','Exceção: '||p_excecao,'excecao',p_excecao); END IF;
 SELECT max(at),jsonb_agg(chave) INTO recent,ids FROM public.contato_evidencias(p_lead) WHERE at<=p_agora AND excecao IS NULL;
 IF recent>p_agora-interval '24 hours' THEN next_at:=recent+interval '24 hours'; reason:='intervalo_24h'; END IF;
 IF p_nao_urgente AND recent>p_agora-interval '72 hours' THEN next_at:=greatest(next_at,recent+interval '72 hours');reason:='intervalo_72h'; END IF;
 IF EXISTS(SELECT 1 FROM public.contato_execucoes WHERE lead_id=p_lead AND chave<>p_chave AND estado IN ('reservado','incerto') AND excecao IS NULL) THEN
   RETURN jsonb_build_object('elegivel',false,'motivo','reserva_ou_envio_incerto','proxima_tentativa',NULL,'evidencias',ids);
 END IF;
 -- Do not confuse old enrollment cycles with a current task's objective.
 SELECT min(due) INTO pending_at FROM (
   SELECT (t.prazo+time '08:00') AT TIME ZONE 'America/Recife' AS due FROM public.tasks t WHERE
    ((t.fu_tecnico_lead_id=p_lead AND t.fu_tecnico_status IN ('pendente','em_andamento') AND t.fu_tecnico_confirmado_em IS NULL AND p_prioridade>2 AND (p_ciclo IS NULL OR t.fu_tecnico_matricula_id=p_ciclo))
    OR (t.fu_gerencial_lead_id=p_lead AND t.fu_gerencial_status IN ('pendente','em_andamento') AND t.fu_gerencial_confirmado_em IS NULL AND p_prioridade>3 AND (p_ciclo IS NULL OR t.fu_gerencial_matricula_id=p_ciclo)))
    AND t.prazo<=(p_agora AT TIME ZONE 'America/Recife')::date
   UNION ALL SELECT coalesce(prazo_original,created_at) FROM public.contato_execucoes WHERE lead_id=p_lead AND chave<>p_chave AND estado IN ('pendente','adiado') AND prioridade<p_prioridade AND excecao IS NULL AND coalesce(prazo_original,created_at)<=p_agora
 ) due_tasks;
 IF pending_at IS NOT NULL THEN next_at:=greatest(next_at,p_agora+interval '24 hours'); reason:='prioridade_superior_pendente'; END IF;
 RETURN jsonb_build_object('elegivel',next_at IS NULL,'motivo',reason,'proxima_tentativa',next_at,'evidencias',coalesce(ids,'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.contato_avaliar(uuid,text,uuid,integer,boolean,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contato_avaliar(uuid,text,uuid,integer,boolean,text,text,timestamptz) TO service_role;

CREATE FUNCTION public.contato_intencao(p_intencao jsonb,p_reservar boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l public.leads; e public.contato_execucoes; decision jsonb; mode text; allowed boolean; intent_unit uuid; cycle uuid; priority int;
BEGIN
 IF jsonb_typeof(p_intencao)<>'object' OR length(coalesce(p_intencao->>'chave','')) NOT BETWEEN 1 AND 1000
 OR length(coalesce(p_intencao->>'fluxo','')) NOT BETWEEN 1 AND 100 OR length(coalesce(p_intencao->>'objetivo','')) NOT BETWEEN 1 AND 100
 OR p_intencao->>'canal' NOT IN ('whatsapp','presencial','telefone','outro') THEN RAISE EXCEPTION 'Intenção inválida'; END IF;
 intent_unit:=(p_intencao->>'unidade_id')::uuid; cycle:=nullif(p_intencao->>'ciclo_id','')::uuid;priority:=(p_intencao->>'prioridade')::integer;
 IF priority NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'Prioridade inválida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_intencao->>'lead_id',0));
 SELECT * INTO l FROM public.leads WHERE id=(p_intencao->>'lead_id')::uuid;
 IF l.id IS NULL OR l.unidade_id IS DISTINCT FROM intent_unit THEN RAISE EXCEPTION 'Aluno ou unidade indisponível'; END IF;
 SELECT * INTO e FROM public.contato_execucoes WHERE chave=p_intencao->>'chave';
 mode:=public.contato_modo(p_intencao->>'fluxo',intent_unit);
 IF e.id IS NOT NULL AND (e.lead_id<>l.id OR e.objetivo<>p_intencao->>'objetivo') THEN RAISE EXCEPTION 'Identidade do contato incompatível'; END IF;
 IF e.id IS NOT NULL AND e.estado IN ('enviado','concluido','cancelado','incerto','reservado') THEN
   RETURN jsonb_build_object('id',e.id,'permitido',NOT p_reservar,'modo',mode,'motivo','contato_'||e.estado);
 END IF;
 IF mode='ativo' AND e.proxima_tentativa>now() THEN RETURN jsonb_build_object('id',e.id,'permitido',false,'modo',mode,'motivo',e.motivo,'proxima_tentativa',e.proxima_tentativa); END IF;
 decision:=public.contato_avaliar(l.id,p_intencao->>'objetivo',cycle,priority,coalesce((p_intencao->>'nao_urgente')::boolean,true),nullif(p_intencao->>'excecao',''),p_intencao->>'chave');
 allowed:=mode='observacao' OR (decision->>'elegivel')::boolean;
 INSERT INTO public.contato_execucoes(lead_id,unidade_id,ciclo_id,chave,fluxo,objetivo,tipo_fu,setor,canal,telefone_normalizado,responsavel,prioridade,nao_urgente,excecao,estado,modo,prazo_original,adiado_em,proxima_tentativa,reservado_em,motivo,evidencias)
 VALUES(l.id,intent_unit,cycle,p_intencao->>'chave',p_intencao->>'fluxo',p_intencao->>'objetivo',p_intencao->>'tipo_fu',p_intencao->>'setor',p_intencao->>'canal',public.canonical_phone(l.telefone),p_intencao->>'responsavel',priority,coalesce((p_intencao->>'nao_urgente')::boolean,true),nullif(p_intencao->>'excecao',''),
 CASE WHEN allowed AND p_reservar THEN 'reservado' WHEN mode='ativo' AND NOT allowed THEN 'adiado' ELSE 'pendente' END,mode,nullif(p_intencao->>'prazo_original','')::timestamptz,
 CASE WHEN decision->>'elegivel'='false' THEN now() END,(decision->>'proxima_tentativa')::timestamptz,CASE WHEN allowed AND p_reservar THEN now() END,decision->>'motivo',coalesce(decision->'evidencias','[]'::jsonb))
 ON CONFLICT(chave) DO UPDATE SET estado=EXCLUDED.estado,modo=EXCLUDED.modo,adiado_em=coalesce(contato_execucoes.adiado_em,EXCLUDED.adiado_em),proxima_tentativa=EXCLUDED.proxima_tentativa,reservado_em=EXCLUDED.reservado_em,motivo=EXCLUDED.motivo,evidencias=EXCLUDED.evidencias,observacoes=CASE WHEN contato_execucoes.motivo IS DISTINCT FROM EXCLUDED.motivo THEN contato_execucoes.observacoes||jsonb_build_array(jsonb_build_object('em',now(),'motivo_anterior',contato_execucoes.motivo,'motivo',EXCLUDED.motivo,'proxima_tentativa',EXCLUDED.proxima_tentativa)) ELSE contato_execucoes.observacoes END,updated_at=now()
 RETURNING id INTO e.id;
 RETURN jsonb_build_object('id',e.id,'permitido',allowed,'modo',mode,'motivo',decision->>'motivo','proxima_tentativa',decision->'proxima_tentativa');
END $$;
REVOKE ALL ON FUNCTION public.contato_intencao(jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contato_intencao(jsonb,boolean) TO service_role;
CREATE FUNCTION public.contato_reservar(p_intencao jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT public.contato_intencao(p_intencao,true) $$;
CREATE FUNCTION public.contato_observar(p_intencao jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT public.contato_intencao(p_intencao,false) $$;
REVOKE ALL ON FUNCTION public.contato_reservar(jsonb),public.contato_observar(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contato_reservar(jsonb),public.contato_observar(jsonb) TO service_role;

CREATE FUNCTION public.contato_resultado(p_id uuid,p_estado text,p_resultado text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.contato_execucoes;
BEGIN
 IF p_estado NOT IN ('enviado','incerto','pendente') OR length(p_resultado)>2000 THEN RAISE EXCEPTION 'Resultado inválido'; END IF;
 SELECT * INTO e FROM public.contato_execucoes WHERE id=p_id;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva ausente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(e.lead_id::text,0));
 UPDATE public.contato_execucoes SET estado=p_estado,enviado_em=CASE WHEN p_estado='enviado' THEN now() END,resultado=p_resultado,updated_at=now() WHERE id=p_id AND estado='reservado';
END $$;
REVOKE ALL ON FUNCTION public.contato_resultado(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contato_resultado(uuid,text,text) TO service_role;

-- Capture confirmed manual/CRM evidence in the same transaction. Notifications/links change none of these fields.
CREATE FUNCTION public.contato_registrar_evidencia(p_lead uuid,p_unidade uuid,p_chave text,p_fluxo text,p_objetivo text,p_ciclo uuid,p_tipo text,p_setor text,p_canal text,p_responsavel text,p_data timestamptz,p_resultado text,p_prioridade integer,p_excecao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_lead::text,0));
 UPDATE public.contato_execucoes SET estado='cancelado',motivo='Contato manual efetivamente registrado; candidato interno encerrado',updated_at=now() WHERE lead_id=p_lead AND chave LIKE 'candidato:%' AND fluxo=p_fluxo AND ciclo_id IS NOT DISTINCT FROM p_ciclo AND estado IN ('pendente','adiado');
 INSERT INTO public.contato_execucoes(lead_id,unidade_id,chave,fluxo,objetivo,ciclo_id,tipo_fu,setor,canal,responsavel,enviado_em,estado,prioridade,nao_urgente,excecao,resultado,telefone_normalizado)
 VALUES(p_lead,p_unidade,p_chave,p_fluxo,p_objetivo,p_ciclo,p_tipo,p_setor,p_canal,p_responsavel,p_data,'enviado',p_prioridade,true,p_excecao,p_resultado,(SELECT public.canonical_phone(telefone) FROM public.leads WHERE id=p_lead)) ON CONFLICT(chave) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.contato_registrar_evidencia(uuid,uuid,text,text,text,uuid,text,text,text,text,timestamptz,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contato_registrar_evidencia(uuid,uuid,text,text,text,uuid,text,text,text,text,timestamptz,text,integer,text) TO service_role;

CREATE FUNCTION public.contato_tarefa_evidencia() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j jsonb; oldj jsonb; prefix text; person uuid; cycle uuid; objective text; sector text; priority int; r jsonb; d timestamptz; k text;
BEGIN
 j:=to_jsonb(NEW);oldj:=to_jsonb(OLD);
 FOREACH prefix IN ARRAY ARRAY['fu_tecnico','fu_gerencial','fu_matriculados'] LOOP
  person:=nullif(j->>(prefix||'_lead_id'),'')::uuid;cycle:=nullif(j->>(prefix||'_matricula_id'),'')::uuid;
  IF person IS NULL THEN CONTINUE; END IF;
  objective:=CASE prefix WHEN 'fu_tecnico' THEN 'tecnico' WHEN 'fu_gerencial' THEN 'experiencia' ELSE 'boas_vindas' END;
  sector:=CASE prefix WHEN 'fu_tecnico' THEN 'coordenador' WHEN 'fu_gerencial' THEN 'gerente' ELSE 'comercial' END;
  priority:=CASE prefix WHEN 'fu_tecnico' THEN 2 WHEN 'fu_gerencial' THEN 3 ELSE 4 END;
  IF j->>(prefix||'_confirmado_em') IS NOT NULL AND oldj->>(prefix||'_confirmado_em') IS NULL THEN
   PERFORM public.contato_registrar_evidencia(person,NEW.unidade_id,'manual:'||prefix||':'||NEW.id,prefix,objective,cycle,j->>(prefix||'_etapa'),sector,'whatsapp',j->>(prefix||'_confirmado_nome'),(j->>(prefix||'_confirmado_em'))::timestamptz,'Confirmação manual Telegram; acompanhamento separado',priority,CASE WHEN prefix='fu_matriculados' THEN 'transicao_matricula' END);
  END IF;
  r:=j->(prefix||'_registro');
  IF r IS NOT NULL AND r->>'canal' IN ('presencial','whatsapp') AND j->>(prefix||'_status')='concluido' AND oldj->>(prefix||'_status') IS DISTINCT FROM 'concluido' THEN
   d:=((r->>'data')::date+time '23:59:59') AT TIME ZONE 'America/Recife';d:=least(d,now());
   k:='registro:'||prefix||':'||NEW.id;
   PERFORM public.contato_registrar_evidencia(person,NEW.unidade_id,k,prefix,objective,cycle,j->>(prefix||'_etapa'),sector,r->>'canal',coalesce(r->>'coordenador',r->>'gerente',NEW.responsavel),d,r::text,priority);
   UPDATE public.contato_execucoes SET acompanhamento_concluido_em=now() WHERE chave=k;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contato_tarefa_evidencia() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER contato_tarefa_evidencia AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.contato_tarefa_evidencia();

CREATE FUNCTION public.contato_interacao_evidencia() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE channel text; meta jsonb; contact_at timestamptz;
BEGIN
 IF TG_OP='UPDATE' AND NEW.contato_meta IS NOT DISTINCT FROM OLD.contato_meta THEN RETURN NEW; END IF;
 meta:=NEW.contato_meta;
 IF meta IS NULL OR meta->>'estado'<>'enviado' THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL AND NEW.created_by IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Responsável do contato inválido'; END IF;
 IF meta->>'canal' NOT IN ('whatsapp','presencial','telefone','outro') OR length(coalesce(meta->>'objetivo','')) NOT BETWEEN 1 AND 100
 OR NEW.created_by IS NULL OR NEW.data_interacao>now() THEN RAISE EXCEPTION 'Contato realizado inválido'; END IF;
 channel:=meta->>'canal';contact_at:=NEW.data_interacao;
 PERFORM public.contato_registrar_evidencia(NEW.lead_id,NEW.unidade_id,'interacao:'||NEW.id,'crm_manual',meta->>'objetivo',nullif(meta->>'ciclo_id','')::uuid,meta->>'tipo_fu',coalesce(meta->>'setor','recepcao'),channel,NEW.atendido_por,contact_at,coalesce(meta->>'resultado',NEW.descricao),1,nullif(meta->>'excecao',''));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contato_interacao_evidencia() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER contato_interacao_evidencia AFTER INSERT OR UPDATE ON public.interacoes FOR EACH ROW EXECUTE FUNCTION public.contato_interacao_evidencia();