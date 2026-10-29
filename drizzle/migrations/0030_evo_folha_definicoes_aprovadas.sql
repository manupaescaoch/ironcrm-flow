CREATE OR REPLACE FUNCTION public.folha_validar_definicoes_aprovadas() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ajuda jsonb; ajuste jsonb; soma numeric; tipo_colab text;
BEGIN
  IF NEW.dados ? 'comissao_manual' AND (jsonb_typeof(NEW.dados->'comissao_manual') IS DISTINCT FROM 'number' OR (NEW.dados->>'comissao_manual')::numeric < 0 OR (NEW.dados->>'comissao_manual')::numeric > 1000000) THEN RAISE EXCEPTION 'Comissão manual exige valor não negativo'; END IF;
  IF NEW.dados ? 'ajuda_custo' THEN
    SELECT tipo INTO tipo_colab FROM public.folha_colaboradores WHERE id=NEW.colaborador_id AND unidade_id=NEW.unidade_id;
    IF tipo_colab IS DISTINCT FROM 'CLT' THEN RAISE EXCEPTION 'Ajuda de custo discriminada é exclusiva de CLT'; END IF;
    ajuda=NEW.dados->'ajuda_custo';
    IF jsonb_typeof(ajuda) IS DISTINCT FROM 'object' OR jsonb_typeof(ajuda->'passagem') IS DISTINCT FROM 'number' OR jsonb_typeof(ajuda->'alimentacao') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Passagem e alimentação exigem valores explícitos'; END IF;
    IF (ajuda->>'passagem')::numeric<0 OR (ajuda->>'alimentacao')::numeric<0 OR (ajuda->>'passagem')::numeric>1000000 OR (ajuda->>'alimentacao')::numeric>1000000 THEN RAISE EXCEPTION 'Ajuda de custo inválida'; END IF;
    IF jsonb_typeof(ajuda->'ajustes') IS DISTINCT FROM 'array' OR jsonb_array_length(ajuda->'ajustes')>100 THEN RAISE EXCEPTION 'Ajustes da ajuda inválidos'; END IF;
    IF (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(ajuda->'ajustes') x)<>jsonb_array_length(ajuda->'ajustes') THEN RAISE EXCEPTION 'Ajustes da ajuda com identidade duplicada'; END IF;
    soma=(ajuda->>'passagem')::numeric+(ajuda->>'alimentacao')::numeric;
    FOR ajuste IN SELECT * FROM jsonb_array_elements(ajuda->'ajustes') LOOP
      IF length(trim(COALESCE(ajuste->>'id','')))=0 OR length(trim(COALESCE(ajuste->>'descricao','')))=0 OR COALESCE(ajuste->>'tipo','') NOT IN ('adicional','desconto') OR jsonb_typeof(ajuste->'valor') IS DISTINCT FROM 'number' OR (ajuste->>'valor')::numeric<0 OR (ajuste->>'valor')::numeric>1000000 THEN RAISE EXCEPTION 'Ajuste da ajuda exige identificação e valor não negativo'; END IF;
      soma=soma+CASE WHEN ajuste->>'tipo'='adicional' THEN (ajuste->>'valor')::numeric ELSE -(ajuste->>'valor')::numeric END;
    END LOOP;
    IF soma<0 THEN RAISE EXCEPTION 'Total da ajuda de custo não pode ser negativo'; END IF;
  END IF;
  NEW.updated_by=COALESCE(auth.uid(),NEW.updated_by);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.folha_validar_definicoes_aprovadas() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER folha_definicoes_aprovadas BEFORE INSERT OR UPDATE ON public.folha_lancamentos FOR EACH ROW EXECUTE FUNCTION public.folha_validar_definicoes_aprovadas();
COMMENT ON FUNCTION public.folha_validar_definicoes_aprovadas() IS 'Comissão manual e ajuda CLT discriminada, sem reprocessar competências fechadas; auditoria existente preserva autoria e alterações.';
CREATE OR REPLACE FUNCTION public.folha_pode_global(_user_id uuid,_acao text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
SELECT _user_id IS NOT NULL AND public.folha_chamador_pode_consultar(_user_id) AND (
 public.has_role(_user_id,'admin'::public.app_role) OR (
 _acao<>'regras' AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='gerente'::public.app_role) AND
 (_acao IN ('ver','documentos','dados_pessoais') OR EXISTS(SELECT 1 FROM public.folha_permissoes WHERE user_id=_user_id AND acao=_acao))))
$$;
COMMENT ON FUNCTION public.folha_pode_global(uuid,text) IS 'Gerentes: ver, CPF/PIX e documentos/Clara somente nos vínculos autorizados por folha_pode_acessar; demais ações preservadas; regras globais admin-only.';