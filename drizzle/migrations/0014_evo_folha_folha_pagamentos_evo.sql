CREATE OR REPLACE FUNCTION public.folha_pode_acessar(_user_id uuid, _unidade_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT _user_id IS NOT NULL AND public.can_manage_contas_pagar(_user_id) AND (
    public.has_role(_user_id,'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.user_unidades WHERE user_id=_user_id AND unidade_id=_unidade_id))
$$;

CREATE TABLE public.folha_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  regras jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.folha_config TO authenticated;
GRANT ALL ON public.folha_config TO service_role;
ALTER TABLE public.folha_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_config_select ON public.folha_config FOR SELECT TO authenticated USING (public.can_manage_contas_pagar(auth.uid()));
CREATE POLICY folha_config_admin_ins ON public.folha_config FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY folha_config_admin_upd ON public.folha_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
-- Configuração inicial é operação administrativa separada, não dados de homologação.

CREATE TABLE public.folha_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  nome text NOT NULL,
  cpf text,
  tipo text NOT NULL CHECK (tipo IN ('CLT','ESTAGIARIO')),
  funcao text,
  turno text,
  turno2 text,
  base numeric(12,2) NOT NULL DEFAULT 0,
  passagem numeric(12,2) NOT NULL DEFAULT 0,
  lider boolean NOT NULL DEFAULT false,
  lider_valor numeric(12,2),
  valor_fds numeric(12,2),
  valor_feriado numeric(12,2),
  pix text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX folha_colaboradores_unidade_idx ON public.folha_colaboradores(unidade_id);
GRANT SELECT, INSERT, UPDATE ON public.folha_colaboradores TO authenticated;
GRANT ALL ON public.folha_colaboradores TO service_role;
ALTER TABLE public.folha_colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_colab_all ON public.folha_colaboradores FOR ALL TO authenticated
  USING (public.folha_pode_acessar(auth.uid(), unidade_id)) WITH CHECK (public.folha_pode_acessar(auth.uid(), unidade_id));

CREATE TABLE public.folha_competencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada')),
  regras jsonb,
  snapshot jsonb,
  fechada_em timestamptz,
  fechada_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, competencia)
);
GRANT SELECT, INSERT, UPDATE ON public.folha_competencias TO authenticated;
GRANT ALL ON public.folha_competencias TO service_role;
ALTER TABLE public.folha_competencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_comp_all ON public.folha_competencias FOR ALL TO authenticated
  USING (public.folha_pode_acessar(auth.uid(), unidade_id)) WITH CHECK (public.folha_pode_acessar(auth.uid(), unidade_id));

CREATE TABLE public.folha_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  colaborador_id uuid NOT NULL REFERENCES public.folha_colaboradores(id),
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  liquido_importado numeric(12,2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (colaborador_id, competencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folha_lancamentos TO authenticated;
GRANT ALL ON public.folha_lancamentos TO service_role;
ALTER TABLE public.folha_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_lanc_all ON public.folha_lancamentos FOR ALL TO authenticated
  USING (public.folha_pode_acessar(auth.uid(), unidade_id)) WITH CHECK (public.folha_pode_acessar(auth.uid(), unidade_id));

CREATE TABLE public.folha_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  colaborador_id uuid NOT NULL REFERENCES public.folha_colaboradores(id),
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  valor numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago')),
  confirmado_em timestamptz,
  confirmado_por uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, competencia)
);
COMMENT ON TABLE public.folha_pagamentos IS 'Registro interno de pagamento da folha; nunca executa PIX ou transferência.';
GRANT SELECT, INSERT, UPDATE ON public.folha_pagamentos TO authenticated;
GRANT ALL ON public.folha_pagamentos TO service_role;
ALTER TABLE public.folha_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_pag_all ON public.folha_pagamentos FOR ALL TO authenticated
  USING (public.folha_pode_acessar(auth.uid(), unidade_id)) WITH CHECK (public.folha_pode_acessar(auth.uid(), unidade_id));

CREATE TABLE public.folha_auditoria (
  id bigserial PRIMARY KEY,
  tabela text NOT NULL,
  registro_id uuid,
  unidade_id uuid,
  competencia text,
  acao text NOT NULL,
  antes jsonb,
  depois jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.folha_auditoria TO authenticated;
GRANT ALL ON public.folha_auditoria TO service_role;
GRANT USAGE ON SEQUENCE public.folha_auditoria_id_seq TO service_role;
ALTER TABLE public.folha_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY folha_aud_select ON public.folha_auditoria FOR SELECT TO authenticated USING (public.folha_pode_acessar(auth.uid(), unidade_id) OR (unidade_id IS NULL AND public.has_role(auth.uid(),'admin'::public.app_role)));

CREATE OR REPLACE FUNCTION public.folha_auditar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE r jsonb := to_jsonb(COALESCE(NEW, OLD));
BEGIN
  INSERT INTO public.folha_auditoria(tabela, registro_id, unidade_id, competencia, acao, antes, depois, user_id)
  VALUES (TG_TABLE_NAME,
    CASE WHEN TG_TABLE_NAME='folha_config' THEN NULL ELSE (r->>'id')::uuid END,
    NULLIF(r->>'unidade_id','')::uuid, r->>'competencia', TG_OP,
    CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END, auth.uid());
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_folha_aud_config AFTER INSERT OR UPDATE ON public.folha_config FOR EACH ROW EXECUTE FUNCTION public.folha_auditar();
CREATE TRIGGER trg_folha_aud_colab AFTER INSERT OR UPDATE OR DELETE ON public.folha_colaboradores FOR EACH ROW EXECUTE FUNCTION public.folha_auditar();
CREATE TRIGGER trg_folha_aud_comp AFTER INSERT OR UPDATE OR DELETE ON public.folha_competencias FOR EACH ROW EXECUTE FUNCTION public.folha_auditar();
CREATE TRIGGER trg_folha_aud_lanc AFTER INSERT OR UPDATE OR DELETE ON public.folha_lancamentos FOR EACH ROW EXECUTE FUNCTION public.folha_auditar();
CREATE TRIGGER trg_folha_aud_pag AFTER INSERT OR UPDATE OR DELETE ON public.folha_pagamentos FOR EACH ROW EXECUTE FUNCTION public.folha_auditar();

-- Competência fechada congela lançamentos e valores dos pagamentos.
CREATE OR REPLACE FUNCTION public.folha_bloquear_fechada() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE r record := COALESCE(NEW, OLD);
BEGIN
  IF EXISTS (SELECT 1 FROM public.folha_competencias WHERE unidade_id=r.unidade_id AND competencia=r.competencia AND status='fechada') THEN
    IF TG_TABLE_NAME='folha_pagamentos' THEN
      IF TG_OP='INSERT' OR TG_OP='DELETE' OR NEW.valor IS DISTINCT FROM OLD.valor OR NEW.colaborador_id IS DISTINCT FROM OLD.colaborador_id THEN
        RAISE EXCEPTION 'Competência % fechada: valores congelados', r.competencia;
      END IF;
    ELSE
      RAISE EXCEPTION 'Competência % fechada: lançamentos congelados', r.competencia;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_folha_lanc_fechada BEFORE INSERT OR UPDATE OR DELETE ON public.folha_lancamentos FOR EACH ROW EXECUTE FUNCTION public.folha_bloquear_fechada();
CREATE TRIGGER trg_folha_pag_fechada BEFORE INSERT OR UPDATE OR DELETE ON public.folha_pagamentos FOR EACH ROW EXECUTE FUNCTION public.folha_bloquear_fechada();

-- Competência fechada não pode ter regras/snapshot alterados; reabrir é exclusivo do admin.
CREATE OR REPLACE FUNCTION public.folha_proteger_competencia() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF OLD.status='fechada' THEN
    IF NEW.status='aberta' THEN
      IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Somente administradores reabrem competências'; END IF;
      IF EXISTS (SELECT 1 FROM public.folha_pagamentos WHERE unidade_id=OLD.unidade_id AND competencia=OLD.competencia AND status='pago') THEN
        RAISE EXCEPTION 'Competência com pagamentos confirmados não pode ser reaberta';
      END IF;
    ELSIF NEW.regras IS DISTINCT FROM OLD.regras OR NEW.snapshot IS DISTINCT FROM OLD.snapshot THEN
      RAISE EXCEPTION 'Competência fechada: regras congeladas';
    END IF;
  END IF;
  IF NEW.status='fechada' AND OLD.status='aberta' THEN
    IF NEW.regras IS NULL OR NEW.snapshot IS NULL THEN RAISE EXCEPTION 'Fechamento exige regras e snapshot'; END IF;
    NEW.fechada_em := now(); NEW.fechada_por := auth.uid();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_folha_comp_proteger BEFORE UPDATE ON public.folha_competencias FOR EACH ROW EXECUTE FUNCTION public.folha_proteger_competencia();

-- Confirmação de pagamento: carimbo do servidor; sem execução bancária.
CREATE OR REPLACE FUNCTION public.folha_pagamento_carimbo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status='pago' AND (TG_OP='INSERT' OR OLD.status<>'pago') THEN
    NEW.confirmado_em := now(); NEW.confirmado_por := auth.uid();
  ELSIF NEW.status='pendente' THEN
    NEW.confirmado_em := NULL; NEW.confirmado_por := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_folha_pag_carimbo BEFORE INSERT OR UPDATE ON public.folha_pagamentos FOR EACH ROW EXECUTE FUNCTION public.folha_pagamento_carimbo();

CREATE TRIGGER trg_folha_colab_updated BEFORE UPDATE ON public.folha_colaboradores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_folha_lanc_updated BEFORE UPDATE ON public.folha_lancamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();