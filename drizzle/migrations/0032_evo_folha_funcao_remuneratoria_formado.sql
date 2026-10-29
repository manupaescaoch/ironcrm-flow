-- 0032: função remuneratória explícita de professor formado (Coordenador de Turno / Coordenador Geral).
-- Classificação do colaborador remunerado, NÃO perfil de acesso. Não altera cadastros existentes (coluna nasce NULL).
-- Competências fechadas mantêm retrato e versão de cálculo; v4 continua recalculando pela regra histórica.
ALTER TABLE public.folha_colaboradores ADD COLUMN IF NOT EXISTS funcao_remuneratoria text;
ALTER TABLE public.folha_colaboradores ADD CONSTRAINT folha_colaboradores_funcao_remuneratoria_check
  CHECK (funcao_remuneratoria IS NULL OR (funcao_remuneratoria IN ('COORDENADOR_TURNO','COORDENADOR_GERAL') AND tipo='CLT'));
COMMENT ON COLUMN public.folha_colaboradores.funcao_remuneratoria IS 'Identificador da função remuneratória de professor formado (COORDENADOR_TURNO, COORDENADOR_GERAL): dia FDS 6h pela regra de formado. Não concede acesso ao sistema; preenchido só manualmente.';
CREATE OR REPLACE FUNCTION public.folha_salvar_vinculo(p_usuario uuid,p_unidade uuid,p_id uuid,p_dados jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE c public.folha_colaboradores; origem public.folha_colaboradores; BEGIN IF NOT public.folha_pode(p_usuario,p_unidade,'ver') OR NOT public.folha_pode(p_usuario,p_unidade,'colaboradores') THEN RAISE EXCEPTION 'Sem permissão nesta unidade'; END IF; IF (p_dados ? 'cpf' OR p_dados ? 'pix') AND NOT public.folha_pode(p_usuario,p_unidade,'dados_pessoais') THEN RAISE EXCEPTION 'Sem permissão explícita para CPF e PIX'; END IF; PERFORM set_config('folha.usuario',p_usuario::text,true); IF p_id IS NOT NULL THEN SELECT * INTO c FROM public.folha_colaboradores WHERE id=p_id AND unidade_id=p_unidade FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo fora da unidade'; END IF; ELSE c.id=gen_random_uuid(); c.unidade_id=p_unidade; c.ativo=true; c.base=0; c.passagem=0; c.lider=false; c.created_by=p_usuario; c.created_at=now(); c.updated_at=now(); END IF; IF p_dados ? 'pessoa_id' THEN SELECT * INTO origem FROM public.folha_colaboradores x WHERE x.pessoa_id=(p_dados->>'pessoa_id')::uuid AND public.folha_pode(p_usuario,x.unidade_id,'ver') AND public.folha_pode(p_usuario,x.unidade_id,'colaboradores') LIMIT 1; IF NOT FOUND THEN RAISE EXCEPTION 'Sem acesso à pessoa de origem'; END IF; END IF; c=jsonb_populate_record(c,p_dados-'id'-'created_by'-'created_at'-'updated_at'-'unidade_id'); c.unidade_id=p_unidade; IF c.tipo='SEM_CONTRATO' THEN c.ativo=false; END IF; IF p_id IS NULL THEN INSERT INTO public.folha_colaboradores SELECT c.*; ELSE UPDATE public.folha_colaboradores SET pessoa_id=c.pessoa_id,nome=c.nome,tipo=c.tipo,cpf=c.cpf,pix=c.pix,funcao=c.funcao,funcao_remuneratoria=c.funcao_remuneratoria,turno=c.turno,turno2=c.turno2,base=c.base,passagem=c.passagem,lider=c.lider,lider_valor=c.lider_valor,valor_fds=c.valor_fds,valor_feriado=c.valor_feriado,ativo=c.ativo WHERE id=p_id AND unidade_id=p_unidade; END IF; RETURN jsonb_build_object('ok',true,'id',c.id); END $$;
REVOKE ALL ON FUNCTION public.folha_salvar_vinculo(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.folha_salvar_vinculo(uuid,uuid,uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.folha_congelar_ajuda_parcelas() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r jsonb; l jsonb; centavos bigint; primeira bigint; datas jsonb;
BEGIN
 IF NEW.status='fechada' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'fechada') AND NEW.versao_calculo IN ('evo-dias-fds-parcelas-config-explicita-v4','evo-funcao-remuneratoria-formado-v5') THEN
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