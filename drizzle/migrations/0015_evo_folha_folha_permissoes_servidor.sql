CREATE TABLE public.folha_permissoes (
  user_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('ver','lancar','colaboradores','fechar','confirmar','desfazer','regras')),
  concedido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, acao)
);
GRANT SELECT, INSERT, DELETE ON public.folha_permissoes TO authenticated;
GRANT ALL ON public.folha_permissoes TO service_role;
ALTER TABLE public.folha_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_perm_select ON public.folha_permissoes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY folha_perm_admin_ins ON public.folha_permissoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY folha_perm_admin_del ON public.folha_permissoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));

-- Admin: tudo. Demais: precisa ser gerente/financeiro (role gerente ou user), ter a ação concedida explicitamente
-- e, quando há unidade, estar vinculado a ela. Coordenador e recepção nunca recebem por padrão.
CREATE OR REPLACE FUNCTION public.folha_pode_global(_user_id uuid, _acao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id,'admin'::public.app_role)
    OR (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('gerente'::public.app_role,'user'::public.app_role))
        AND EXISTS (SELECT 1 FROM public.folha_permissoes WHERE user_id=_user_id AND acao=_acao)))
$$;
CREATE OR REPLACE FUNCTION public.folha_pode(_user_id uuid, _unidade_id uuid, _acao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT public.has_role(_user_id,'admin'::public.app_role)
    OR (public.folha_pode_global(_user_id,_acao)
        AND EXISTS (SELECT 1 FROM public.user_unidades WHERE user_id=_user_id AND unidade_id=_unidade_id))
$$;
CREATE OR REPLACE FUNCTION public.folha_minhas_permissoes(_unidade_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT COALESCE(array_agg(a), '{}') FROM unnest(ARRAY['ver','lancar','colaboradores','fechar','confirmar','desfazer','regras','reabrir']) a
  WHERE CASE WHEN a='reabrir' THEN public.has_role(auth.uid(),'admin'::public.app_role)
             WHEN a='regras' THEN public.folha_pode_global(auth.uid(),a)
             ELSE public.folha_pode(auth.uid(),_unidade_id,a) END
$$;
GRANT EXECUTE ON FUNCTION public.folha_minhas_permissoes(uuid) TO authenticated;

-- Políticas por ação (substituem o acesso amplo via Contas a Pagar).
DROP POLICY IF EXISTS folha_colab_all ON public.folha_colaboradores;
DROP POLICY IF EXISTS folha_comp_all ON public.folha_competencias;
DROP POLICY IF EXISTS folha_lanc_all ON public.folha_lancamentos;
DROP POLICY IF EXISTS folha_pag_all ON public.folha_pagamentos;
DROP POLICY IF EXISTS folha_aud_select ON public.folha_auditoria;
DROP POLICY IF EXISTS folha_config_select ON public.folha_config;
DROP POLICY IF EXISTS folha_config_admin_ins ON public.folha_config;
DROP POLICY IF EXISTS folha_config_admin_upd ON public.folha_config;

CREATE POLICY folha_colab_sel ON public.folha_colaboradores FOR SELECT TO authenticated USING (public.folha_pode(auth.uid(), unidade_id, 'ver'));
CREATE POLICY folha_colab_ins ON public.folha_colaboradores FOR INSERT TO authenticated WITH CHECK (public.folha_pode(auth.uid(), unidade_id, 'colaboradores'));
CREATE POLICY folha_colab_upd ON public.folha_colaboradores FOR UPDATE TO authenticated USING (public.folha_pode(auth.uid(), unidade_id, 'colaboradores')) WITH CHECK (public.folha_pode(auth.uid(), unidade_id, 'colaboradores'));

CREATE POLICY folha_lanc_sel ON public.folha_lancamentos FOR SELECT TO authenticated USING (public.folha_pode(auth.uid(), unidade_id, 'ver'));
CREATE POLICY folha_lanc_ins ON public.folha_lancamentos FOR INSERT TO authenticated WITH CHECK (public.folha_pode(auth.uid(), unidade_id, 'lancar'));
CREATE POLICY folha_lanc_upd ON public.folha_lancamentos FOR UPDATE TO authenticated USING (public.folha_pode(auth.uid(), unidade_id, 'lancar')) WITH CHECK (public.folha_pode(auth.uid(), unidade_id, 'lancar'));
CREATE POLICY folha_lanc_del ON public.folha_lancamentos FOR DELETE TO authenticated USING (public.folha_pode(auth.uid(), unidade_id, 'lancar'));

-- Fechamento e pagamentos: somente leitura no navegador; escrita apenas pela função do servidor.
REVOKE INSERT, UPDATE, DELETE ON public.folha_competencias FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.folha_pagamentos FROM authenticated;
CREATE POLICY folha_comp_sel ON public.folha_competencias FOR SELECT TO authenticated USING (public.folha_pode(auth.uid(), unidade_id, 'ver'));
CREATE POLICY folha_pag_sel ON public.folha_pagamentos FOR SELECT TO authenticated USING (public.folha_pode(auth.uid(), unidade_id, 'ver'));

CREATE POLICY folha_aud_sel ON public.folha_auditoria FOR SELECT TO authenticated USING (
  (unidade_id IS NOT NULL AND public.folha_pode(auth.uid(), unidade_id, 'ver'))
  OR (unidade_id IS NULL AND public.folha_pode_global(auth.uid(), 'regras')));

REVOKE INSERT ON public.folha_config FROM authenticated;
CREATE POLICY folha_config_sel ON public.folha_config FOR SELECT TO authenticated USING (public.folha_pode_global(auth.uid(), 'ver'));
CREATE POLICY folha_config_upd ON public.folha_config FOR UPDATE TO authenticated USING (public.folha_pode_global(auth.uid(), 'regras')) WITH CHECK (public.folha_pode_global(auth.uid(), 'regras'));
CREATE TRIGGER trg_folha_config_updated BEFORE UPDATE ON public.folha_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Retrato completo e rastreabilidade.
ALTER TABLE public.folha_competencias ADD COLUMN IF NOT EXISTS versao_calculo text, ADD COLUMN IF NOT EXISTS hash_entrada text, ADD COLUMN IF NOT EXISTS total numeric(12,2);
ALTER TABLE public.folha_pagamentos ADD COLUMN IF NOT EXISTS colaborador_nome text, ADD COLUMN IF NOT EXISTS pix text,
  ADD COLUMN IF NOT EXISTS valor_confirmado numeric(12,2), ADD COLUMN IF NOT EXISTS versao_calculo text, ADD COLUMN IF NOT EXISTS desfeito_em timestamptz, ADD COLUMN IF NOT EXISTS desfeito_por uuid;

-- Lançamentos disputam o mesmo bloqueio do fechamento: não há edição entre a leitura e o fechamento.
CREATE OR REPLACE FUNCTION public.folha_bloquear_fechada() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE r record := COALESCE(NEW, OLD);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('folha:' || r.unidade_id::text || ':' || r.competencia));
  IF EXISTS (SELECT 1 FROM public.folha_competencias WHERE unidade_id=r.unidade_id AND competencia=r.competencia AND status='fechada') THEN
    IF TG_TABLE_NAME='folha_pagamentos' THEN
      IF TG_OP='INSERT' OR TG_OP='DELETE' OR NEW.valor IS DISTINCT FROM OLD.valor OR NEW.colaborador_id IS DISTINCT FROM OLD.colaborador_id
         OR NEW.pix IS DISTINCT FROM OLD.pix OR NEW.colaborador_nome IS DISTINCT FROM OLD.colaborador_nome THEN
        RAISE EXCEPTION 'Competência % fechada: valores congelados', r.competencia;
      END IF;
    ELSE
      RAISE EXCEPTION 'Competência % fechada: lançamentos congelados', r.competencia;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.folha_proteger_competencia() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF OLD.status='fechada' THEN
    IF NEW.status='aberta' THEN
      IF EXISTS (SELECT 1 FROM public.folha_pagamentos WHERE unidade_id=OLD.unidade_id AND competencia=OLD.competencia AND status='pago') THEN
        RAISE EXCEPTION 'Competência com pagamentos confirmados não pode ser reaberta';
      END IF;
    ELSIF NEW.regras IS DISTINCT FROM OLD.regras OR NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.total IS DISTINCT FROM OLD.total THEN
      RAISE EXCEPTION 'Competência fechada: regras congeladas';
    END IF;
  END IF;
  IF NEW.status='fechada' AND OLD.status='aberta' THEN
    IF NEW.regras IS NULL OR NEW.snapshot IS NULL OR NEW.versao_calculo IS NULL THEN RAISE EXCEPTION 'Fechamento exige regras, retrato e versão do cálculo'; END IF;
    NEW.fechada_em := now();
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.folha_pagamento_carimbo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status='pago' AND (TG_OP='INSERT' OR OLD.status<>'pago') THEN
    NEW.confirmado_em := now();
  ELSIF NEW.status='pendente' AND TG_OP='UPDATE' AND OLD.status='pago' THEN
    NEW.confirmado_em := NULL; NEW.confirmado_por := NULL; NEW.valor_confirmado := NULL; NEW.desfeito_em := now();
  END IF;
  RETURN NEW;
END $$;

-- Auditoria registra o usuário real mesmo quando a escrita vem da função do servidor.
CREATE OR REPLACE FUNCTION public.folha_auditar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE r jsonb := to_jsonb(COALESCE(NEW, OLD)); u uuid;
BEGIN
  u := COALESCE(auth.uid(), NULLIF(current_setting('folha.usuario', true),'')::uuid);
  INSERT INTO public.folha_auditoria(tabela, registro_id, unidade_id, competencia, acao, antes, depois, user_id)
  VALUES (TG_TABLE_NAME,
    CASE WHEN TG_TABLE_NAME='folha_config' THEN NULL ELSE (r->>'id')::uuid END,
    NULLIF(r->>'unidade_id','')::uuid, r->>'competencia', TG_OP,
    CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END, u);
  RETURN COALESCE(NEW, OLD);
END $$;

-- Impressão digital da entrada (cadastros, lançamentos, regras) usada para detectar mudança concorrente.
CREATE OR REPLACE FUNCTION public.folha_hash_entrada(p_unidade uuid, p_comp text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT md5(
    COALESCE((SELECT string_agg(id::text||'@'||updated_at::text, ',' ORDER BY id) FROM public.folha_colaboradores WHERE unidade_id=p_unidade),'') || '|' ||
    COALESCE((SELECT string_agg(id::text||'@'||updated_at::text, ',' ORDER BY id) FROM public.folha_lancamentos WHERE unidade_id=p_unidade AND competencia=p_comp),'') || '|' ||
    COALESCE((SELECT updated_at::text FROM public.folha_config WHERE id=1),''))
$$;

CREATE OR REPLACE FUNCTION public.folha_registrar_fechamento(
  p_unidade uuid, p_comp text, p_usuario uuid, p_hash text, p_regras jsonb, p_snapshot jsonb, p_pagamentos jsonb, p_versao text, p_total numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE k record; p jsonb;
BEGIN
  PERFORM set_config('folha.usuario', p_usuario::text, true);
  PERFORM pg_advisory_xact_lock(hashtext('folha:' || p_unidade::text || ':' || p_comp));
  SELECT * INTO k FROM public.folha_competencias WHERE unidade_id=p_unidade AND competencia=p_comp FOR UPDATE;
  IF FOUND AND k.status='fechada' THEN
    RETURN jsonb_build_object('ok', true, 'ja_fechada', true, 'competencia_id', k.id, 'total', k.total);
  END IF;
  IF public.folha_hash_entrada(p_unidade, p_comp) IS DISTINCT FROM p_hash THEN
    RAISE EXCEPTION 'Dados da folha mudaram durante o fechamento; tente novamente' USING ERRCODE='40001';
  END IF;
  IF NOT FOUND THEN
    INSERT INTO public.folha_competencias(unidade_id, competencia) VALUES (p_unidade, p_comp) RETURNING * INTO k;
  END IF;
  FOR p IN SELECT * FROM jsonb_array_elements(p_pagamentos) LOOP
    INSERT INTO public.folha_pagamentos(unidade_id, colaborador_id, competencia, valor, colaborador_nome, pix, versao_calculo, status)
    VALUES (p_unidade, (p->>'colaborador_id')::uuid, p_comp, (p->>'valor')::numeric, p->>'colaborador_nome', p->>'pix', p_versao, 'pendente')
    ON CONFLICT (colaborador_id, competencia) DO UPDATE SET valor=EXCLUDED.valor, colaborador_nome=EXCLUDED.colaborador_nome,
      pix=EXCLUDED.pix, versao_calculo=EXCLUDED.versao_calculo, status='pendente';
  END LOOP;
  DELETE FROM public.folha_pagamentos WHERE unidade_id=p_unidade AND competencia=p_comp
    AND colaborador_id NOT IN (SELECT (x->>'colaborador_id')::uuid FROM jsonb_array_elements(p_pagamentos) x);
  UPDATE public.folha_competencias SET status='fechada', regras=p_regras, snapshot=p_snapshot, versao_calculo=p_versao,
    hash_entrada=p_hash, total=p_total, fechada_por=p_usuario WHERE id=k.id;
  RETURN jsonb_build_object('ok', true, 'ja_fechada', false, 'competencia_id', k.id, 'total', p_total);
END $$;

CREATE OR REPLACE FUNCTION public.folha_registrar_pagamento(p_pagamento uuid, p_usuario uuid, p_acao text, p_valor numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE g record;
BEGIN
  PERFORM set_config('folha.usuario', p_usuario::text, true);
  SELECT * INTO g FROM public.folha_pagamentos WHERE id=p_pagamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento não encontrado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.folha_competencias WHERE unidade_id=g.unidade_id AND competencia=g.competencia AND status='fechada') THEN
    RAISE EXCEPTION 'Competência não está fechada';
  END IF;
  IF p_acao='confirmar' THEN
    IF g.status='pago' THEN RETURN jsonb_build_object('ok', true, 'ja_pago', true, 'valor', g.valor_confirmado); END IF;
    IF p_valor IS DISTINCT FROM g.valor THEN RAISE EXCEPTION 'Valor recalculado diverge do retrato fechado'; END IF;
    UPDATE public.folha_pagamentos SET status='pago', valor_confirmado=p_valor, confirmado_por=p_usuario WHERE id=g.id;
    RETURN jsonb_build_object('ok', true, 'ja_pago', false, 'valor', p_valor);
  ELSIF p_acao='desfazer' THEN
    IF g.status='pendente' THEN RETURN jsonb_build_object('ok', true, 'ja_pendente', true); END IF;
    UPDATE public.folha_pagamentos SET status='pendente', desfeito_por=p_usuario WHERE id=g.id;
    RETURN jsonb_build_object('ok', true, 'ja_pendente', false);
  END IF;
  RAISE EXCEPTION 'Ação inválida';
END $$;

CREATE OR REPLACE FUNCTION public.folha_registrar_reabertura(p_competencia uuid, p_usuario uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE k record;
BEGIN
  PERFORM set_config('folha.usuario', p_usuario::text, true);
  SELECT * INTO k FROM public.folha_competencias WHERE id=p_competencia FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Competência não encontrada'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('folha:' || k.unidade_id::text || ':' || k.competencia));
  IF k.status='aberta' THEN RETURN jsonb_build_object('ok', true, 'ja_aberta', true); END IF;
  UPDATE public.folha_competencias SET status='aberta', regras=NULL, snapshot=NULL, total=NULL, hash_entrada=NULL, versao_calculo=NULL, fechada_em=NULL, fechada_por=NULL WHERE id=k.id;
  RETURN jsonb_build_object('ok', true, 'ja_aberta', false);
END $$;

REVOKE ALL ON FUNCTION public.folha_hash_entrada(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.folha_registrar_fechamento(uuid,text,uuid,text,jsonb,jsonb,jsonb,text,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.folha_registrar_pagamento(uuid,uuid,text,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.folha_registrar_reabertura(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.folha_hash_entrada(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.folha_registrar_fechamento(uuid,text,uuid,text,jsonb,jsonb,jsonb,text,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.folha_registrar_pagamento(uuid,uuid,text,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.folha_registrar_reabertura(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.folha_pode_acessar(uuid,uuid) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.folha_pode_acessar(uuid,uuid) IS 'DEPRECATED: replaced by folha_pode(user, unidade, acao)';