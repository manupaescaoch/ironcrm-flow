-- Additive preparation only. No contact sends, task backfill or changes to legacy uniqueness.
CREATE TABLE public.fu_transicao_config (
 unidade_id uuid NOT NULL REFERENCES public.unidades(id),
 familia text NOT NULL CHECK(familia IN ('R01','R02','G02')),
 modo text NOT NULL DEFAULT 'OBSERVACAO' CHECK(modo IN ('LEGADO','OBSERVACAO','NOVO')),
 ciclos_desde timestamptz,
 aprovado_em timestamptz,
 aprovacao text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(unidade_id,familia),
 CHECK(modo<>'NOVO' OR (ciclos_desde IS NOT NULL AND aprovado_em IS NOT NULL AND length(trim(aprovacao))>0))
);
GRANT ALL ON public.fu_transicao_config TO service_role;
ALTER TABLE public.fu_transicao_config ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.fu_transicao_homologacoes (
 unidade_id uuid NOT NULL REFERENCES public.unidades(id),
 substituto text NOT NULL CHECK(substituto IN ('MATRICULADOS','TECNICO_M7','TECNICO_M21','GERENCIAL_M30')),
 evidencias jsonb NOT NULL,
 autorizado_em timestamptz NOT NULL,
 autorizacao text NOT NULL CHECK(length(trim(autorizacao))>0),
 homologado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(unidade_id,substituto)
);
GRANT ALL ON public.fu_transicao_homologacoes TO service_role;
ALTER TABLE public.fu_transicao_homologacoes ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.fu_transicao_eventos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lead_id uuid NOT NULL REFERENCES public.leads(id),
 unidade_id uuid NOT NULL REFERENCES public.unidades(id),
 ciclo_id uuid REFERENCES public.interacoes(id),
 legado_id uuid,
 familia text NOT NULL CHECK(familia IN ('R01','R02','G02')),
 etapa text NOT NULL,
 modo text NOT NULL CHECK(modo IN ('LEGADO','OBSERVACAO','NOVO')),
 estado text NOT NULL CHECK(estado IN ('observado','preservado','suprimido')),
 motivo text NOT NULL,
 substitutos jsonb NOT NULL,
 contexto jsonb NOT NULL,
 chave text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fu_transicao_eventos TO authenticated;
GRANT SELECT,INSERT ON public.fu_transicao_eventos TO service_role;
ALTER TABLE public.fu_transicao_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY fu_transicao_historico ON public.fu_transicao_eventos FOR SELECT TO authenticated USING (
 public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.leads l WHERE l.id=lead_id AND l.unidade_id IN(SELECT public.get_user_unidades(auth.uid())))
);
CREATE INDEX fu_transicao_historico_lead ON public.fu_transicao_eventos(lead_id,created_at);

CREATE FUNCTION public.fu_transicao_matriz(p_familia text,p_etapa text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE
 WHEN p_familia='R01' AND p_etapa='D+1' THEN ARRAY['MATRICULADOS']
 WHEN (p_familia='R01' AND p_etapa='D+7') OR (p_familia='R02' AND p_etapa='M+7') OR (p_familia='G02' AND p_etapa='G+7') THEN ARRAY['TECNICO_M7']
 WHEN p_familia='R01' AND p_etapa='D+30' THEN ARRAY['TECNICO_M21','GERENCIAL_M30']
 WHEN (p_familia='R02' AND p_etapa='M+30') OR (p_familia='G02' AND p_etapa='G+30') THEN ARRAY['GERENCIAL_M30']
 ELSE ARRAY[]::text[] END
$$;
REVOKE ALL ON FUNCTION public.fu_transicao_matriz(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_transicao_matriz(text,text) TO service_role;

CREATE FUNCTION public.fu_transicao_homologado(p_unidade uuid,p_substituto text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.fu_transicao_homologacoes h WHERE h.unidade_id=p_unidade AND h.substituto=p_substituto
 AND h.evidencias @> '{"geracao":true,"grupo_correto":true,"mensagem_campos":true,"abrir":true,"enviado":true,"edicao_original":true,"acompanhamento_separado":true,"resultado":true,"sem_retroativos":true,"evento_legitimo":true}'::jsonb
 AND (p_substituto<>'GERENCIAL_M30' OR h.evidencias @> '{"historico_consultado":true}'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.fu_transicao_homologado(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_transicao_homologado(uuid,text) TO service_role;

-- All writes require the actual service identity; an authenticated admin is not a service.
CREATE FUNCTION public.fu_transicao_proteger_config() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s text; family text; unit uuid;
BEGIN
 IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN RAISE EXCEPTION 'Configuração restrita ao serviço autorizado'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF TG_TABLE_NAME='fu_transicao_config' THEN
 IF NEW.modo='NOVO' THEN
  FOREACH s IN ARRAY CASE NEW.familia WHEN 'R01' THEN ARRAY['MATRICULADOS','TECNICO_M7','TECNICO_M21','GERENCIAL_M30'] WHEN 'R02' THEN ARRAY['TECNICO_M7','GERENCIAL_M30'] ELSE ARRAY['TECNICO_M7','GERENCIAL_M30'] END LOOP
   IF NOT public.fu_transicao_homologado(NEW.unidade_id,s) THEN RAISE EXCEPTION 'Substituto % não homologado nesta unidade',s; END IF;
  END LOOP;
 END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fu_transicao_proteger_config() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fu_transicao_config_protegida BEFORE INSERT OR UPDATE OR DELETE ON public.fu_transicao_config FOR EACH ROW EXECUTE FUNCTION public.fu_transicao_proteger_config();
CREATE TRIGGER fu_transicao_homologacao_protegida BEFORE INSERT OR UPDATE OR DELETE ON public.fu_transicao_homologacoes FOR EACH ROW EXECUTE FUNCTION public.fu_transicao_proteger_config();

CREATE FUNCTION public.fu_transicao_avaliar(p_candidato jsonb,p_registrar boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l public.leads; i public.interacoes; cfg public.fu_transicao_config;
 family text; stage text; unit uuid; cycle uuid; legacy uuid; required text[]; s text; task_id uuid; task_ids jsonb:='[]';
 reason text:='sem_substituto_elegivel'; ready boolean:=true; suppress boolean:=false; mode text:='OBSERVACAO'; ref date; info jsonb; result jsonb;
BEGIN
 family:=p_candidato->>'familia';stage:=p_candidato->>'etapa';unit:=(p_candidato->>'unidade_id')::uuid;
 cycle:=nullif(p_candidato->>'ciclo_id','')::uuid;legacy:=nullif(p_candidato->>'legado_id','')::uuid;
 required:=public.fu_transicao_matriz(family,stage);
 IF cardinality(required)=0 THEN RAISE EXCEPTION 'Família ou etapa inválida'; END IF;
 SELECT * INTO l FROM public.leads WHERE id=(p_candidato->>'lead_id')::uuid;
 IF l.id IS NULL OR l.unidade_id IS DISTINCT FROM unit THEN RAISE EXCEPTION 'Aluno ou unidade incompatível'; END IF;
 SELECT * INTO cfg FROM public.fu_transicao_config WHERE unidade_id=unit AND familia=family;
 mode:=coalesce(cfg.modo,'OBSERVACAO');
 -- Persisted D+ conversion records are NEVER enrollment R01 roster items.
 IF legacy IS NOT NULL THEN
  IF family='R01' OR NOT EXISTS(SELECT 1 FROM public.follow_ups f WHERE f.id=legacy AND f.lead_id=l.id AND f.unidade_id=unit AND f.tipo=stage AND ((family='R02' AND f.tipo IN('M+7','M+30')) OR (family='G02' AND f.tipo IN('G+7','G+30')))) THEN RAISE EXCEPTION 'Contato legado não pertence à família'; END IF;
 END IF;
 IF cycle IS NULL AND family='R02' THEN
  ref:=nullif(p_candidato->>'referencia','')::timestamptz AT TIME ZONE 'America/Recife';
  -- Ambiguous or absent enrollment references preserve the legacy, never guess the newest cycle.
  IF (SELECT count(*) FROM public.interacoes WHERE lead_id=l.id AND fechou_matricula=true AND cancelado IS DISTINCT FROM true AND data_interacao::date=ref)=1 THEN
   SELECT id INTO cycle FROM public.interacoes WHERE lead_id=l.id AND fechou_matricula=true AND cancelado IS DISTINCT FROM true AND data_interacao::date=ref;
  END IF;
 END IF;
 SELECT * INTO i FROM public.interacoes WHERE id=cycle AND lead_id=l.id;
 IF i.id IS NULL OR i.fechou_matricula IS DISTINCT FROM true OR i.cancelado=true OR i.data_fechamento IS NULL OR l.ativo IS DISTINCT FROM true OR l.is_matriculado IS DISTINCT FROM true OR l.pausado_fu=true THEN ready:=false;reason:='ciclo_inativo_ou_indeterminado';
 ELSIF upper(coalesce(i.tipo,'')) LIKE '%RENOVA%' OR upper(coalesce(l.origem,'')) LIKE '%IMPORT%' THEN ready:=false;reason:='renovacao_ou_importacao';
 ELSIF mode='NOVO' AND (cfg.ciclos_desde IS NULL OR i.created_at<cfg.ciclos_desde OR i.data_fechamento<(cfg.ciclos_desde AT TIME ZONE 'America/Recife')::date) THEN ready:=false;reason:='ciclo_anterior_a_transicao';
 ELSE
  FOREACH s IN ARRAY required LOOP
   task_id:=NULL;
   SELECT t.id INTO task_id FROM public.tasks t WHERE t.unidade_id=unit AND (
    (s='MATRICULADOS' AND t.fu_matriculados_lead_id=l.id AND t.fu_matriculados_matricula_id=i.id AND (t.status<>'concluida' OR t.fu_matriculados_confirmado_em IS NOT NULL) AND t.fu_matriculados_envio_erro IS NULL)
    OR (s IN('TECNICO_M7','TECNICO_M21') AND t.fu_tecnico_lead_id=l.id AND t.fu_tecnico_matricula_id=i.id AND t.fu_tecnico_etapa=CASE s WHEN 'TECNICO_M7' THEN 'M+7' ELSE 'M+21' END AND t.fu_tecnico_status IN('pendente','em_andamento','concluido') AND t.fu_tecnico_envio_erro IS NULL)
    OR (s='GERENCIAL_M30' AND t.fu_gerencial_lead_id=l.id AND t.fu_gerencial_matricula_id=i.id AND t.fu_gerencial_etapa='M+30' AND t.fu_gerencial_status IN('pendente','em_andamento','concluido') AND t.fu_gerencial_envio_erro IS NULL)) LIMIT 1;
   IF task_id IS NULL THEN ready:=false;reason:='substituto_ausente_ou_indisponivel'; ELSE task_ids:=task_ids||jsonb_build_array(task_id); END IF;
   IF mode='NOVO' AND NOT public.fu_transicao_homologado(unit,s) THEN ready:=false;reason:='substituto_nao_homologado'; END IF;
   IF mode='NOVO' AND NOT EXISTS(SELECT 1 FROM public.telegram_groups WHERE unidade_id=unit AND status='conectado' AND group_type=CASE s WHEN 'MATRICULADOS' THEN 'comercial' WHEN 'GERENCIAL_M30' THEN 'gerencia' ELSE 'coordenadores' END) THEN ready:=false;reason:='grupo_substituto_indisponivel'; END IF;
  END LOOP;
 END IF;
 IF ready THEN reason:=CASE WHEN mode='NOVO' THEN 'substituto_homologado' ELSE 'sobreposicao_identificada_sem_supressao' END; END IF;
 suppress:=mode='NOVO' AND ready AND cfg.aprovado_em IS NOT NULL AND length(trim(cfg.aprovacao))>0;
 info:=jsonb_build_object('objetivos',required,'tarefas',task_ids,'data_confirmacao',i.data_fechamento,'origem',i.tipo,'unidade_registro',i.unidade_id,'elegivel',ready,'referencia',p_candidato->>'referencia');
 result:=jsonb_build_object('modo',mode,'suprimir',suppress,'motivo',reason,'ciclo_id',cycle,'substitutos',task_ids);
 IF p_registrar THEN
  INSERT INTO public.fu_transicao_eventos(lead_id,unidade_id,ciclo_id,legado_id,familia,etapa,modo,estado,motivo,substitutos,contexto,chave)
  VALUES(l.id,unit,i.id,legacy,family,stage,mode,CASE WHEN suppress THEN 'suprimido' WHEN ready THEN 'observado' ELSE 'preservado' END,reason,task_ids,info,
    md5(concat_ws('|',l.id,unit,cycle,legacy,family,stage,mode,reason,task_ids::text,cfg.updated_at::text))) ON CONFLICT(chave) DO NOTHING;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.fu_transicao_avaliar(jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_transicao_avaliar(jsonb,boolean) TO service_role;

-- Read-only frontend gate: never accepts mode/approval or writes observations.
CREATE FUNCTION public.fu_transicao_filtrar(p_unidade uuid,p_familia text,p_candidatos jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb; d jsonb; output jsonb:='[]';
BEGIN
 IF auth.uid() IS NULL OR NOT(public.has_role(auth.uid(),'admin') OR p_unidade IN(SELECT public.get_user_unidades(auth.uid()))) THEN RAISE EXCEPTION 'Unidade não autorizada'; END IF;
 IF p_familia NOT IN('R01','G02') OR jsonb_typeof(p_candidatos)<>'array' OR jsonb_array_length(p_candidatos)>500 THEN RAISE EXCEPTION 'Lista inválida'; END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(p_candidatos) LOOP
  d:=public.fu_transicao_avaliar(jsonb_build_object('familia',p_familia,'etapa',c->>'etapa','lead_id',c->>'lead_id','unidade_id',p_unidade,'ciclo_id',c->>'ciclo_id'),false);
  IF d->>'suprimir'='true' THEN output:=output||jsonb_build_array(jsonb_build_object('lead_id',c->>'lead_id','etapa',c->>'etapa')); END IF;
 END LOOP;
 RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.fu_transicao_filtrar(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fu_transicao_filtrar(uuid,text,jsonb) TO authenticated;

CREATE TABLE public.fu_transicao_config_historico (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entidade text NOT NULL,
 operacao text NOT NULL,
 anterior jsonb,
 atual jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT ON public.fu_transicao_config_historico TO service_role;
ALTER TABLE public.fu_transicao_config_historico ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.fu_transicao_auditar_config() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO public.fu_transicao_config_historico(entidade,operacao,anterior,atual) VALUES(TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fu_transicao_auditar_config() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER fu_transicao_config_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.fu_transicao_config FOR EACH ROW EXECUTE FUNCTION public.fu_transicao_auditar_config();
CREATE TRIGGER fu_transicao_homologacao_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.fu_transicao_homologacoes FOR EACH ROW EXECUTE FUNCTION public.fu_transicao_auditar_config();