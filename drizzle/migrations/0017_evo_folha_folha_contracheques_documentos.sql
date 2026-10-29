-- Novas ações: importar contracheques e baixar/exportar documentos.
ALTER TABLE public.folha_permissoes DROP CONSTRAINT IF EXISTS folha_permissoes_acao_check;
ALTER TABLE public.folha_permissoes ADD CONSTRAINT folha_permissoes_acao_check
  CHECK (acao IN ('ver','lancar','colaboradores','fechar','confirmar','desfazer','regras','importar','documentos'));

CREATE OR REPLACE FUNCTION public.folha_minhas_permissoes(_unidade_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT COALESCE(array_agg(a), '{}') FROM unnest(ARRAY['ver','lancar','colaboradores','fechar','confirmar','desfazer','regras','importar','documentos','reabrir']) a
  WHERE CASE WHEN a='reabrir' THEN public.has_role(auth.uid(),'admin'::public.app_role)
             WHEN a='regras' THEN public.folha_pode_global(auth.uid(),a)
             ELSE public.folha_pode(auth.uid(),_unidade_id,a) END
$$;

-- Importações de contracheque (arquivo original privado + itens revisados).
CREATE TABLE public.folha_contracheques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  arquivo_path text NOT NULL,
  arquivo_nome text NOT NULL,
  arquivo_hash text NOT NULL,
  formato text NOT NULL CHECK (formato IN ('pdf','xlsx','xls','csv')),
  extracao text NOT NULL CHECK (extracao IN ('texto_pdf','planilha','manual_ocr_pendente')),
  referencia_detectada text,
  status text NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado','apagado')),
  total_liquido numeric(12,2) NOT NULL DEFAULT 0,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  apagado_por uuid,
  apagado_em timestamptz
);
CREATE UNIQUE INDEX folha_contracheques_hash_ativo ON public.folha_contracheques(unidade_id, arquivo_hash) WHERE status='confirmado';
CREATE UNIQUE INDEX folha_contracheques_comp_ativo ON public.folha_contracheques(unidade_id, competencia) WHERE status='confirmado';

CREATE TABLE public.folha_contracheque_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contracheque_id uuid NOT NULL REFERENCES public.folha_contracheques(id),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  competencia text NOT NULL,
  colaborador_id uuid NOT NULL REFERENCES public.folha_colaboradores(id),
  pagina integer,
  nome_lido text,
  funcao text,
  bruto numeric(12,2) NOT NULL DEFAULT 0,
  liquido numeric(12,2) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX folha_contracheque_itens_colab_ativo ON public.folha_contracheque_itens(colaborador_id, competencia) WHERE ativo;

GRANT SELECT ON public.folha_contracheques TO authenticated;
GRANT SELECT ON public.folha_contracheque_itens TO authenticated;
GRANT ALL ON public.folha_contracheques TO service_role;
GRANT ALL ON public.folha_contracheque_itens TO service_role;
ALTER TABLE public.folha_contracheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folha_contracheque_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_cc_sel ON public.folha_contracheques FOR SELECT TO authenticated USING (public.folha_pode(auth.uid(), unidade_id, 'ver'));
CREATE POLICY folha_cci_sel ON public.folha_contracheque_itens FOR SELECT TO authenticated USING (public.folha_pode(auth.uid(), unidade_id, 'ver'));
CREATE TRIGGER trg_folha_aud_cc AFTER INSERT OR UPDATE OR DELETE ON public.folha_contracheques FOR EACH ROW EXECUTE FUNCTION public.folha_auditar();
CREATE TRIGGER trg_folha_aud_cci AFTER INSERT OR UPDATE OR DELETE ON public.folha_contracheque_itens FOR EACH ROW EXECUTE FUNCTION public.folha_auditar();

-- O líquido importado só muda pela importação no servidor; o navegador não grava nem altera esse valor.
CREATE OR REPLACE FUNCTION public.folha_proteger_liquido_importado() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF COALESCE(current_setting('folha.importacao', true),'') <> '1' THEN
    IF TG_OP='INSERT' AND NEW.liquido_importado IS NOT NULL THEN
      RAISE EXCEPTION 'Líquido de contracheque só pode ser gravado pela importação revisada';
    ELSIF TG_OP='UPDATE' AND NEW.liquido_importado IS DISTINCT FROM OLD.liquido_importado THEN
      RAISE EXCEPTION 'Líquido de contracheque só pode ser alterado pela importação revisada';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_folha_lanc_liquido BEFORE INSERT OR UPDATE ON public.folha_lancamentos FOR EACH ROW EXECUTE FUNCTION public.folha_proteger_liquido_importado();

-- Grava importação revisada: valida competência aberta, colaboradores da unidade (CLT), duplicidades. Idempotente por hash.
CREATE OR REPLACE FUNCTION public.folha_registrar_contracheque(
  p_unidade uuid, p_comp text, p_usuario uuid, p_path text, p_nome text, p_hash text, p_formato text, p_extracao text, p_ref text, p_itens jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE k uuid; it jsonb; c record; tot numeric := 0; ex record;
BEGIN
  PERFORM set_config('folha.usuario', p_usuario::text, true);
  PERFORM pg_advisory_xact_lock(hashtext('folha:' || p_unidade::text || ':' || p_comp));
  IF EXISTS (SELECT 1 FROM public.folha_competencias WHERE unidade_id=p_unidade AND competencia=p_comp AND status='fechada') THEN
    RAISE EXCEPTION 'Competência % fechada: importação recusada', p_comp;
  END IF;
  SELECT id, competencia INTO ex FROM public.folha_contracheques WHERE unidade_id=p_unidade AND arquivo_hash=p_hash AND status='confirmado';
  IF FOUND THEN
    RAISE EXCEPTION 'Este arquivo já foi importado (competência %). Apague a importação anterior para ler novamente', ex.competencia;
  END IF;
  IF EXISTS (SELECT 1 FROM public.folha_contracheques WHERE unidade_id=p_unidade AND competencia=p_comp AND status='confirmado') THEN
    RAISE EXCEPTION 'Contracheque já foi lido neste mês. Para ler novamente, apague a importação anterior';
  END IF;
  IF jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'Nenhum item revisado'; END IF;
  IF (SELECT count(DISTINCT x->>'colaborador_id') FROM jsonb_array_elements(p_itens) x) <> jsonb_array_length(p_itens) THEN
    RAISE EXCEPTION 'O mesmo colaborador aparece mais de uma vez na importação';
  END IF;
  INSERT INTO public.folha_contracheques(unidade_id, competencia, arquivo_path, arquivo_nome, arquivo_hash, formato, extracao, referencia_detectada, criado_por)
  VALUES (p_unidade, p_comp, p_path, p_nome, p_hash, p_formato, p_extracao, p_ref, p_usuario) RETURNING id INTO k;
  PERFORM set_config('folha.importacao', '1', true);
  FOR it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    SELECT * INTO c FROM public.folha_colaboradores WHERE id=(it->>'colaborador_id')::uuid;
    IF NOT FOUND OR c.unidade_id <> p_unidade THEN RAISE EXCEPTION 'Colaborador não pertence a esta unidade'; END IF;
    IF c.tipo <> 'CLT' THEN RAISE EXCEPTION 'Contracheque só pode ser associado a colaborador CLT (%)', c.nome; END IF;
    IF (it->>'liquido') IS NULL OR (it->>'liquido')::numeric < 0 THEN RAISE EXCEPTION 'Líquido inválido para %', c.nome; END IF;
    IF EXISTS (SELECT 1 FROM public.folha_contracheque_itens WHERE colaborador_id=c.id AND competencia=p_comp AND ativo) THEN
      RAISE EXCEPTION '% já tem contracheque importado nesta competência', c.nome;
    END IF;
    INSERT INTO public.folha_contracheque_itens(contracheque_id, unidade_id, competencia, colaborador_id, pagina, nome_lido, funcao, bruto, liquido)
    VALUES (k, p_unidade, p_comp, c.id, NULLIF(it->>'pagina','')::int, it->>'nome_lido', it->>'funcao', COALESCE((it->>'bruto')::numeric,0), (it->>'liquido')::numeric);
    -- Substitui (nunca soma) o valor do mês.
    INSERT INTO public.folha_lancamentos(unidade_id, colaborador_id, competencia, dados, liquido_importado, updated_by)
    VALUES (p_unidade, c.id, p_comp, '{}'::jsonb, (it->>'liquido')::numeric, p_usuario)
    ON CONFLICT (colaborador_id, competencia) DO UPDATE SET liquido_importado=EXCLUDED.liquido_importado, updated_by=p_usuario;
    tot := tot + (it->>'liquido')::numeric;
  END LOOP;
  UPDATE public.folha_contracheques SET total_liquido=tot WHERE id=k;
  RETURN jsonb_build_object('ok', true, 'contracheque_id', k, 'itens', jsonb_array_length(p_itens), 'total_liquido', tot);
END $$;

CREATE OR REPLACE FUNCTION public.folha_apagar_contracheque(p_id uuid, p_usuario uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE k record;
BEGIN
  PERFORM set_config('folha.usuario', p_usuario::text, true);
  SELECT * INTO k FROM public.folha_contracheques WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Importação não encontrada'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('folha:' || k.unidade_id::text || ':' || k.competencia));
  IF k.status='apagado' THEN RETURN jsonb_build_object('ok', true, 'ja_apagado', true); END IF;
  IF EXISTS (SELECT 1 FROM public.folha_competencias WHERE unidade_id=k.unidade_id AND competencia=k.competencia AND status='fechada') THEN
    RAISE EXCEPTION 'Competência fechada: importação não pode ser apagada';
  END IF;
  PERFORM set_config('folha.importacao', '1', true);
  UPDATE public.folha_lancamentos l SET liquido_importado=NULL, updated_by=p_usuario
    FROM public.folha_contracheque_itens i WHERE i.contracheque_id=p_id AND i.ativo AND l.colaborador_id=i.colaborador_id AND l.competencia=i.competencia;
  UPDATE public.folha_contracheque_itens SET ativo=false WHERE contracheque_id=p_id;
  UPDATE public.folha_contracheques SET status='apagado', apagado_por=p_usuario, apagado_em=now() WHERE id=p_id;
  RETURN jsonb_build_object('ok', true, 'ja_apagado', false);
END $$;
REVOKE ALL ON FUNCTION public.folha_registrar_contracheque(uuid,text,uuid,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.folha_apagar_contracheque(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.folha_registrar_contracheque(uuid,text,uuid,text,text,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.folha_apagar_contracheque(uuid,uuid) TO service_role;

-- Arquivos: envio pelo navegador só para quem pode importar na unidade da pasta; leitura apenas por link temporário emitido pelo servidor.
CREATE POLICY folha_docs_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='folha-documentos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.folha_pode(auth.uid(), ((storage.foldername(name))[1])::uuid, 'importar'));