-- PENDENTE DE APROVAÇÃO: não aplicar em produção sem autorização de Emanuel Paes.
-- Ajuda de Custo mensal com fonte única e fechamento próprio, independente do fechamento salarial
-- e de Contas a Pagar. Reutiliza folha_ajuda_parcelas, folha_lote_ajuda e folha_auditoria.

CREATE TABLE public.folha_ajuda_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  colaborador_id uuid NOT NULL REFERENCES public.folha_colaboradores(id),
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, colaborador_id, competencia)
);
GRANT SELECT ON public.folha_ajuda_lancamentos TO authenticated;
GRANT ALL ON public.folha_ajuda_lancamentos TO service_role;
ALTER TABLE public.folha_ajuda_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_ajuda_lanc_leitura ON public.folha_ajuda_lancamentos FOR SELECT TO authenticated
  USING (public.folha_pode(auth.uid(), unidade_id, 'ver'));

CREATE TABLE public.folha_ajuda_competencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada')),
  versao_calculo text NOT NULL DEFAULT 'ajuda-mensal-v1',
  snapshot jsonb,
  total numeric(14,2),
  fechada_em timestamptz,
  fechada_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, competencia)
);
GRANT SELECT ON public.folha_ajuda_competencias TO authenticated;
GRANT ALL ON public.folha_ajuda_competencias TO service_role;
ALTER TABLE public.folha_ajuda_competencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_ajuda_comp_leitura ON public.folha_ajuda_competencias FOR SELECT TO authenticated
  USING (public.folha_pode(auth.uid(), unidade_id, 'ver'));

-- Lançamentos de mês fechado não mudam.
CREATE OR REPLACE FUNCTION public.folha_ajuda_bloquear_fechada() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.folha_ajuda_competencias k WHERE k.unidade_id = COALESCE(NEW.unidade_id, OLD.unidade_id)
             AND k.competencia = COALESCE(NEW.competencia, OLD.competencia) AND k.status = 'fechada') THEN
    RAISE EXCEPTION 'Ajuda de custo fechada nesta competência';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.folha_ajuda_bloquear_fechada() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER folha_ajuda_bloquear BEFORE INSERT OR UPDATE OR DELETE ON public.folha_ajuda_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.folha_ajuda_bloquear_fechada();

-- Fechamento próprio: valores calculados pelo servidor (motor compartilhado) e congelados com PIX do cadastro.
CREATE OR REPLACE FUNCTION public.folha_ajuda_fechar(p_usuario uuid, p_unidade uuid, p_comp text, p_linhas jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k record; x jsonb; total numeric := 0; snap jsonb; cid uuid;
BEGIN
  IF NOT public.folha_pode(p_usuario, p_unidade, 'fechar') THEN RAISE EXCEPTION 'Sem permissão para fechar a ajuda desta unidade' USING ERRCODE='42501'; END IF;
  IF p_comp !~ '^\d{4}-(0[1-9]|1[0-2])$' OR jsonb_typeof(p_linhas) <> 'array' OR jsonb_array_length(p_linhas) = 0 THEN RAISE EXCEPTION 'Parâmetros inválidos'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('folha-ajuda:'||p_unidade::text||':'||p_comp));
  SELECT * INTO k FROM public.folha_ajuda_competencias WHERE unidade_id = p_unidade AND competencia = p_comp FOR UPDATE;
  IF FOUND AND k.status = 'fechada' THEN RETURN jsonb_build_object('ok', true, 'ja_fechada', true, 'total', k.total); END IF;
  -- Nunca duas fontes: parcelas antigas geradas pelo fechamento salarial bloqueiam o fechamento próprio.
  IF EXISTS (SELECT 1 FROM public.folha_ajuda_parcelas WHERE unidade_id = p_unidade AND competencia = p_comp) THEN
    RAISE EXCEPTION 'Esta competência já tem parcelas de ajuda geradas pelo fechamento da folha salarial';
  END IF;
  -- Todas as linhas precisam existir como lançamento preparado na unidade.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_linhas) l WHERE NOT EXISTS (
      SELECT 1 FROM public.folha_ajuda_lancamentos a WHERE a.unidade_id = p_unidade AND a.competencia = p_comp AND a.colaborador_id = (l->>'colaborador_id')::uuid)) THEN
    RAISE EXCEPTION 'Linha fora da ajuda preparada nesta unidade';
  END IF;
  SELECT jsonb_build_object('colaboradores', COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'funcao', c.funcao, 'cpf', c.cpf, 'pix', c.pix)), '[]'),
                            'lancamentos', (SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]') FROM public.folha_ajuda_lancamentos a WHERE a.unidade_id = p_unidade AND a.competencia = p_comp),
                            'resultados', p_linhas, 'gerado_em', now())
    INTO snap FROM public.folha_colaboradores c
    WHERE c.unidade_id = p_unidade AND c.id IN (SELECT (l->>'colaborador_id')::uuid FROM jsonb_array_elements(p_linhas) l);
  FOR x IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    cid := (x->>'colaborador_id')::uuid;
    total := total + (x->>'total')::numeric;
    IF (x->>'total')::numeric > 0 THEN
      INSERT INTO public.folha_ajuda_parcelas(unidade_id, competencia, colaborador_id, parcela, valor, data_prevista, composicao, criado_por) VALUES
        (p_unidade, p_comp, cid, 1, (x->'parcelas'->>0)::numeric, NULLIF(x->'datas'->>0, '')::date, x, p_usuario),
        (p_unidade, p_comp, cid, 2, (x->'parcelas'->>1)::numeric, NULLIF(x->'datas'->>1, '')::date, x, p_usuario);
    END IF;
  END LOOP;
  INSERT INTO public.folha_ajuda_competencias(unidade_id, competencia, status, snapshot, total, fechada_em, fechada_por)
    VALUES (p_unidade, p_comp, 'fechada', snap, total, now(), p_usuario)
    ON CONFLICT (unidade_id, competencia) DO UPDATE SET status = 'fechada', snapshot = EXCLUDED.snapshot, total = EXCLUDED.total, fechada_em = now(), fechada_por = p_usuario;
  INSERT INTO public.folha_auditoria(tabela, unidade_id, competencia, acao, user_id, depois)
    VALUES ('folha_ajuda_competencias', p_unidade, p_comp, 'FECHAR_AJUDA', p_usuario, jsonb_build_object('total', total, 'quantidade', jsonb_array_length(p_linhas)));
  RETURN jsonb_build_object('ok', true, 'total', total);
END $$;
REVOKE ALL ON FUNCTION public.folha_ajuda_fechar(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.folha_ajuda_fechar(uuid, uuid, text, jsonb) TO service_role;

-- Reabrir: só admin (validado pela função), e só se nenhuma parcela foi exportada ou paga.
CREATE OR REPLACE FUNCTION public.folha_ajuda_reabrir(p_usuario uuid, p_unidade uuid, p_comp text, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k record;
BEGIN
  IF NOT public.has_role(p_usuario, 'admin') THEN RAISE EXCEPTION 'Somente administrador reabre a ajuda' USING ERRCODE='42501'; END IF;
  IF COALESCE(trim(p_motivo), '') = '' THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('folha-ajuda:'||p_unidade::text||':'||p_comp));
  SELECT * INTO k FROM public.folha_ajuda_competencias WHERE unidade_id = p_unidade AND competencia = p_comp FOR UPDATE;
  IF NOT FOUND OR k.status <> 'fechada' THEN RAISE EXCEPTION 'Ajuda não está fechada'; END IF;
  IF EXISTS (SELECT 1 FROM public.folha_ajuda_parcelas p WHERE p.unidade_id = p_unidade AND p.competencia = p_comp AND (p.status = 'pago'
     OR EXISTS (SELECT 1 FROM public.folha_auditoria a WHERE a.unidade_id = p_unidade AND a.competencia = p_comp AND a.acao = 'EXPORT_AJUDA_CLARA' AND a.depois->'ids' ? p.id::text))) THEN
    RAISE EXCEPTION 'Parcela já exportada ou paga; reabertura bloqueada';
  END IF;
  DELETE FROM public.folha_ajuda_parcelas WHERE unidade_id = p_unidade AND competencia = p_comp;
  UPDATE public.folha_ajuda_competencias SET status = 'aberta', fechada_em = NULL, fechada_por = NULL WHERE id = k.id;
  INSERT INTO public.folha_auditoria(tabela, registro_id, unidade_id, competencia, acao, user_id, antes, depois)
    VALUES ('folha_ajuda_competencias', k.id, p_unidade, p_comp, 'REABRIR_AJUDA', p_usuario, jsonb_build_object('total', k.total, 'snapshot', k.snapshot), jsonb_build_object('motivo', p_motivo));
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.folha_ajuda_reabrir(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.folha_ajuda_reabrir(uuid, uuid, text, text) TO service_role;

-- Fechamento salarial deixa de gerar parcelas quando a competência já usa a ajuda própria.
CREATE OR REPLACE FUNCTION public.folha_congelar_ajuda_parcelas() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r jsonb; l jsonb; centavos bigint; primeira bigint; datas jsonb;
BEGIN
 IF NEW.status='fechada' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'fechada') AND NEW.versao_calculo IN ('evo-dias-fds-parcelas-config-explicita-v4','evo-funcao-remuneratoria-formado-v5')
    AND NOT EXISTS (SELECT 1 FROM public.folha_ajuda_competencias a WHERE a.unidade_id=NEW.unidade_id AND a.competencia=NEW.competencia)
    AND NOT EXISTS (SELECT 1 FROM public.folha_ajuda_lancamentos a WHERE a.unidade_id=NEW.unidade_id AND a.competencia=NEW.competencia) THEN
  FOR r IN SELECT * FROM jsonb_array_elements(NEW.snapshot->'resultados') LOOP
   IF COALESCE((r->'ajudaCusto'->>'total')::numeric,0)>0 THEN
    SELECT x INTO l FROM jsonb_array_elements(NEW.snapshot->'lancamentos') x WHERE x->>'colaborador_id'=r->>'colaborador_id';
    datas=l->'dados'->'ajuda_custo'->'datas'; centavos=round((r->'ajudaCusto'->>'total')::numeric*100); primeira=round(centavos::numeric/2);
    INSERT INTO public.folha_ajuda_parcelas(unidade_id,competencia,colaborador_id,parcela,valor,data_prevista,composicao,criado_por)
    VALUES(NEW.unidade_id,NEW.competencia,(r->>'colaborador_id')::uuid,1,primeira::numeric/100,NULLIF(datas->>0,'')::date,r->'ajudaCusto',NEW.fechada_por),
    (NEW.unidade_id,NEW.competencia,(r->>'colaborador_id')::uuid,2,(centavos-primeira)::numeric/100,NULLIF(datas->>1,'')::date,r->'ajudaCusto',NEW.fechada_por) ON CONFLICT DO NOTHING;
   END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.folha_congelar_ajuda_parcelas() FROM PUBLIC,anon,authenticated;

-- Lote Clara da ajuda: aceita o fechamento próprio da ajuda; o legado (fechamento salarial) continua válido.
CREATE OR REPLACE FUNCTION public.folha_lote_ajuda(p_usuario uuid,p_unidade uuid,p_comp text,p_parcela integer,p_ids uuid[] DEFAULT NULL,p_exportar boolean DEFAULT false,p_reexportar boolean DEFAULT false,p_hash text DEFAULT NULL,p_opcoes jsonb DEFAULT '[]') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE snap jsonb; fontes jsonb; anteriores jsonb; hash_atual text; total numeric; audit_id bigint;
BEGIN
 IF NOT public.folha_pode(p_usuario,p_unidade,'ver') OR NOT public.folha_pode(p_usuario,p_unidade,'documentos') OR NOT public.folha_pode(p_usuario,p_unidade,'dados_pessoais') THEN RAISE EXCEPTION 'Sem acesso à ajuda nesta unidade' USING ERRCODE='42501'; END IF;
 IF p_parcela NOT IN (1,2) OR p_comp !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Parcela/competência inválida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('folha:'||p_unidade::text||':'||p_comp));
 SELECT a.snapshot INTO snap FROM public.folha_ajuda_competencias a WHERE a.unidade_id=p_unidade AND a.competencia=p_comp AND a.status='fechada';
 IF snap IS NULL THEN
  SELECT k.snapshot INTO snap FROM public.folha_competencias k WHERE k.unidade_id=p_unidade AND k.competencia=p_comp AND k.status='fechada';
 END IF;
 IF snap IS NULL THEN RAISE EXCEPTION 'Ajuda de custo não está fechada'; END IF;
 IF p_exportar AND (p_ids IS NULL OR cardinality(p_ids)=0 OR cardinality(p_ids)>300 OR cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids) x)) THEN RAISE EXCEPTION 'Seleção inválida'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('pagamento_id',p.id,'colaborador_id',p.colaborador_id,'nome',c->>'nome','pix',c->>'pix','cpf',c->>'cpf','valor',p.valor,'status',p.status,'data_prevista',p.data_prevista,'composicao',p.composicao) ORDER BY p.id),'[]') INTO fontes FROM public.folha_ajuda_parcelas p JOIN LATERAL jsonb_array_elements(snap->'colaboradores') c ON c->>'id'=p.colaborador_id::text WHERE p.unidade_id=p_unidade AND p.competencia=p_comp AND p.parcela=p_parcela AND p.status='pendente' AND p.valor>0 AND (p_ids IS NULL OR p.id=ANY(p_ids));
 IF p_ids IS NOT NULL AND jsonb_array_length(fontes)<>cardinality(p_ids) THEN RAISE EXCEPTION 'Parcela fora desta seleção/unidade'; END IF;
 SELECT COALESCE(sum((x->>'valor')::numeric),0) INTO total FROM jsonb_array_elements(fontes) x; hash_atual=md5(fontes::text);
 SELECT COALESCE(jsonb_agg(f->>'pagamento_id'),'[]') INTO anteriores FROM jsonb_array_elements(fontes) f WHERE EXISTS(SELECT 1 FROM public.folha_auditoria a WHERE a.unidade_id=p_unidade AND a.competencia=p_comp AND a.acao='EXPORT_AJUDA_CLARA' AND a.depois->'ids' ? (f->>'pagamento_id'));
 IF p_exportar THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(fontes) f WHERE f->>'data_prevista' IS NULL) THEN RAISE EXCEPTION 'Informe as datas das parcelas antes de exportar'; END IF;
  IF p_hash IS DISTINCT FROM hash_atual THEN RAISE EXCEPTION 'Parcelas mudaram; confira novamente' USING ERRCODE='PT409'; END IF;
  IF jsonb_array_length(anteriores)>0 AND NOT p_reexportar THEN RETURN jsonb_build_object('reexportacao_necessaria',true,'anteriores',anteriores); END IF;
  INSERT INTO public.folha_auditoria(tabela,unidade_id,competencia,acao,user_id,depois) VALUES('folha_ajuda_parcelas',p_unidade,p_comp,'EXPORT_AJUDA_CLARA',p_usuario,jsonb_build_object('ids',to_jsonb(p_ids),'parcela',p_parcela,'quantidade',cardinality(p_ids),'total',total,'reexportacao',jsonb_array_length(anteriores)>0,'opcoes',p_opcoes)) RETURNING id INTO audit_id;
 END IF;
 RETURN jsonb_build_object('fontes',fontes,'hash',hash_atual,'anteriores',anteriores,'total',total,'auditoria_id',audit_id,'unidade_nome',(SELECT nome FROM public.unidades WHERE id=p_unidade),'excluidos_zero',(SELECT count(*) FROM public.folha_ajuda_parcelas WHERE unidade_id=p_unidade AND competencia=p_comp AND parcela=p_parcela AND valor=0));
END $$;
REVOKE ALL ON FUNCTION public.folha_lote_ajuda(uuid,uuid,text,integer,uuid[],boolean,boolean,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.folha_lote_ajuda(uuid,uuid,text,integer,uuid[],boolean,boolean,text,jsonb) TO service_role;

COMMENT ON TABLE public.folha_ajuda_lancamentos IS 'Fonte única da ajuda de custo mensal CLT. Não compõe salário, comissão, líquido nem Contas a Pagar.';
COMMENT ON TABLE public.folha_ajuda_competencias IS 'Fechamento próprio da ajuda de custo, independente do fechamento salarial.';
