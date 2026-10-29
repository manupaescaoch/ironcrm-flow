CREATE OR REPLACE FUNCTION public.folha_lote_clara(p_usuario uuid,p_unidade uuid,p_comp text,p_ids uuid[] DEFAULT NULL,p_exportar boolean DEFAULT false,p_reexportar boolean DEFAULT false,p_hash text DEFAULT NULL,p_opcoes jsonb DEFAULT '[]'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k record; fontes jsonb; excl_pagos integer; excl_zero integer; anteriores jsonb; total numeric; hash_atual text; audit_id bigint;
BEGIN
 IF NOT public.folha_pode(p_usuario,p_unidade,'ver') OR NOT public.folha_pode(p_usuario,p_unidade,'documentos') OR NOT public.folha_pode(p_usuario,p_unidade,'dados_pessoais') THEN RAISE EXCEPTION 'Sem permissão financeira, de exportação ou dados pessoais nesta unidade' USING ERRCODE='42501'; END IF;
 IF p_comp !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competência inválida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('folha:'||p_unidade::text||':'||p_comp));
 SELECT * INTO k FROM public.folha_competencias WHERE unidade_id=p_unidade AND competencia=p_comp FOR UPDATE;
 IF NOT FOUND OR k.status<>'fechada' OR k.snapshot IS NULL THEN RAISE EXCEPTION 'Competência não está fechada'; END IF;
 IF p_exportar AND (p_ids IS NULL OR cardinality(p_ids)=0 OR cardinality(p_ids)>300 OR cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids) x)) THEN RAISE EXCEPTION 'Seleção inválida'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('pagamento_id',p.id,'colaborador_id',p.colaborador_id,'nome',c->>'nome','pix',c->>'pix','cpf',c->>'cpf','valor',(r->>'total')::numeric,'status',p.status) ORDER BY p.id),'[]'::jsonb) INTO fontes
 FROM public.folha_pagamentos p JOIN LATERAL jsonb_array_elements(k.snapshot->'colaboradores') c ON c->>'id'=p.colaborador_id::text JOIN LATERAL jsonb_array_elements(k.snapshot->'resultados') r ON r->>'colaborador_id'=p.colaborador_id::text
 WHERE p.unidade_id=p_unidade AND p.competencia=p_comp AND p.status='pendente' AND (r->>'total')::numeric>0 AND (p_ids IS NULL OR p.id=ANY(p_ids));
 IF p_ids IS NOT NULL AND jsonb_array_length(fontes)<>cardinality(p_ids) THEN RAISE EXCEPTION 'Seleção contém pagamento confirmado, zero ou fora desta unidade/competência'; END IF;
 SELECT count(*) FILTER (WHERE p.status='pago'), count(*) FILTER (WHERE p.status<>'pago' AND COALESCE((r->>'total')::numeric,0)<=0) INTO excl_pagos, excl_zero
 FROM public.folha_pagamentos p LEFT JOIN LATERAL (SELECT y FROM jsonb_array_elements(k.snapshot->'resultados') y WHERE y->>'colaborador_id'=p.colaborador_id::text LIMIT 1) rr(r) ON true
 WHERE p.unidade_id=p_unidade AND p.competencia=p_comp;
 SELECT COALESCE(sum((x->>'valor')::numeric),0) INTO total FROM jsonb_array_elements(fontes) x;
 hash_atual=md5(fontes::text);
 SELECT COALESCE(jsonb_agg(DISTINCT f->>'pagamento_id'),'[]'::jsonb) INTO anteriores FROM jsonb_array_elements(fontes) f WHERE EXISTS(SELECT 1 FROM public.folha_auditoria a WHERE a.unidade_id=p_unidade AND a.competencia=p_comp AND a.acao='EXPORT_CLARA' AND a.depois->'ids' ? (f->>'pagamento_id'));
 IF p_exportar THEN
  IF p_hash IS DISTINCT FROM hash_atual THEN RAISE EXCEPTION 'Pagamentos mudaram; confira novamente' USING ERRCODE='PT409'; END IF;
  IF jsonb_array_length(anteriores)>0 AND NOT p_reexportar THEN RETURN jsonb_build_object('reexportacao_necessaria',true,'anteriores',anteriores); END IF;
  INSERT INTO public.folha_auditoria(tabela,unidade_id,competencia,acao,user_id,depois) VALUES('folha_lote_clara',p_unidade,p_comp,'EXPORT_CLARA',p_usuario,jsonb_build_object('ids',to_jsonb(p_ids),'quantidade',cardinality(p_ids),'total',total,'reexportacao',jsonb_array_length(anteriores)>0,'opcoes',p_opcoes)) RETURNING id INTO audit_id;
 END IF;
 RETURN jsonb_build_object('fontes',fontes,'hash',hash_atual,'total',total,'anteriores',anteriores,'auditoria_id',audit_id,'unidade_nome',(SELECT nome FROM public.unidades WHERE id=p_unidade),'competencia',p_comp,'excluidos_confirmados',excl_pagos,'excluidos_zero',excl_zero);
END $$;
REVOKE ALL ON FUNCTION public.folha_lote_clara(uuid,uuid,text,uuid[],boolean,boolean,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.folha_lote_clara(uuid,uuid,text,uuid[],boolean,boolean,text,jsonb) TO service_role;
COMMENT ON FUNCTION public.folha_lote_clara(uuid,uuid,text,uuid[],boolean,boolean,text,jsonb) IS 'Leitura do retrato fechado e auditoria atômica de exportação Clara, sem baixa ou integrações externas; acesso exclusivo via folha-operacoes.';