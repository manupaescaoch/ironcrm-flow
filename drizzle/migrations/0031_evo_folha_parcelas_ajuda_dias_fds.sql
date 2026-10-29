CREATE TABLE public.folha_ajuda_parcelas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), unidade_id uuid NOT NULL REFERENCES public.unidades(id), competencia text NOT NULL, colaborador_id uuid NOT NULL REFERENCES public.folha_colaboradores(id), parcela integer NOT NULL CHECK(parcela IN (1,2)), valor numeric(14,2) NOT NULL CHECK(valor>=0), data_prevista date, status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','pago')), composicao jsonb NOT NULL, criado_por uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(unidade_id,competencia,colaborador_id,parcela));
GRANT SELECT ON public.folha_ajuda_parcelas TO authenticated;
GRANT ALL ON public.folha_ajuda_parcelas TO service_role;
ALTER TABLE public.folha_ajuda_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_ajuda_leitura ON public.folha_ajuda_parcelas FOR SELECT TO authenticated USING(public.folha_pode(auth.uid(),unidade_id,'ver'));
CREATE OR REPLACE FUNCTION public.folha_congelar_ajuda_parcelas() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r jsonb; l jsonb; centavos bigint; primeira bigint; datas jsonb;
BEGIN
 IF NEW.status='fechada' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'fechada') AND NEW.versao_calculo='evo-dias-fds-parcelas-config-explicita-v4' THEN
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
CREATE TRIGGER folha_congelar_ajuda AFTER INSERT OR UPDATE ON public.folha_competencias FOR EACH ROW EXECUTE FUNCTION public.folha_congelar_ajuda_parcelas();
CREATE OR REPLACE FUNCTION public.folha_validar_dias_parcelas() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s text; dt date; datas jsonb;
BEGIN
 IF NEW.dados ? 'datas_fds' THEN
  IF jsonb_typeof(NEW.dados->'datas_fds')<>'array' THEN RAISE EXCEPTION 'Datas FDS inválidas'; END IF;
  FOR s IN SELECT jsonb_array_elements_text(NEW.dados->'datas_fds') LOOP
   dt=s::date; IF to_char(dt,'YYYY-MM')<>NEW.competencia OR extract(dow from dt) NOT IN (0,6) THEN RAISE EXCEPTION 'Dia FDS deve ser sábado/domingo da competência'; END IF;
  END LOOP;
  SELECT COALESCE(jsonb_agg(x ORDER BY x),'[]'::jsonb) INTO datas FROM (SELECT DISTINCT jsonb_array_elements_text(NEW.dados->'datas_fds') x) t;
  NEW.dados=jsonb_set(NEW.dados,'{datas_fds}',datas);
 END IF;
 datas=NEW.dados->'ajuda_custo'->'datas';
 IF datas IS NOT NULL THEN
  IF jsonb_typeof(datas)<>'array' OR jsonb_array_length(datas)<>2 THEN RAISE EXCEPTION 'Informe duas datas de parcelas'; END IF;
  FOR s IN SELECT jsonb_array_elements_text(datas) LOOP IF s<>'' THEN dt=s::date; END IF; END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.folha_validar_dias_parcelas() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER folha_dias_parcelas BEFORE INSERT OR UPDATE ON public.folha_lancamentos FOR EACH ROW EXECUTE FUNCTION public.folha_validar_dias_parcelas();
CREATE OR REPLACE FUNCTION public.folha_lote_ajuda(p_usuario uuid,p_unidade uuid,p_comp text,p_parcela integer,p_ids uuid[] DEFAULT NULL,p_exportar boolean DEFAULT false,p_reexportar boolean DEFAULT false,p_hash text DEFAULT NULL,p_opcoes jsonb DEFAULT '[]') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k record; fontes jsonb; anteriores jsonb; hash_atual text; total numeric; audit_id bigint;
BEGIN
 IF NOT public.folha_pode(p_usuario,p_unidade,'ver') OR NOT public.folha_pode(p_usuario,p_unidade,'documentos') OR NOT public.folha_pode(p_usuario,p_unidade,'dados_pessoais') THEN RAISE EXCEPTION 'Sem acesso à ajuda nesta unidade' USING ERRCODE='42501'; END IF;
 IF p_parcela NOT IN (1,2) OR p_comp !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Parcela/competência inválida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('folha:'||p_unidade::text||':'||p_comp));
 SELECT * INTO k FROM public.folha_competencias WHERE unidade_id=p_unidade AND competencia=p_comp FOR UPDATE;
 IF NOT FOUND OR k.status<>'fechada' THEN RAISE EXCEPTION 'Competência não está fechada'; END IF;
 IF p_exportar AND (p_ids IS NULL OR cardinality(p_ids)=0 OR cardinality(p_ids)>300 OR cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids) x)) THEN RAISE EXCEPTION 'Seleção inválida'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('pagamento_id',p.id,'colaborador_id',p.colaborador_id,'nome',c->>'nome','pix',c->>'pix','cpf',c->>'cpf','valor',p.valor,'status',p.status,'data_prevista',p.data_prevista,'composicao',p.composicao) ORDER BY p.id),'[]') INTO fontes FROM public.folha_ajuda_parcelas p JOIN LATERAL jsonb_array_elements(k.snapshot->'colaboradores') c ON c->>'id'=p.colaborador_id::text WHERE p.unidade_id=p_unidade AND p.competencia=p_comp AND p.parcela=p_parcela AND p.status='pendente' AND p.valor>0 AND (p_ids IS NULL OR p.id=ANY(p_ids));
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
COMMENT ON TABLE public.folha_ajuda_parcelas IS 'Ajuda CLT em duas parcelas, independente de folha salarial e Contas a Pagar; exportar não paga. Datas explícitas sem vencimentos inventados.';