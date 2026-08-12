-- =========================
-- FORECAST MODULE
-- =========================

CREATE TABLE public.forecast_premissas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  mes integer NOT NULL,
  investimento_previsto numeric(12,2) NOT NULL DEFAULT 0,
  custo_por_conversa numeric(12,2),
  taxa_conversa_lead numeric(6,4) NOT NULL DEFAULT 0,
  taxa_lead_agendamento numeric(6,4) NOT NULL DEFAULT 0,
  taxa_agendamento_comparecimento numeric(6,4) NOT NULL DEFAULT 0,
  taxa_comparecimento_matricula numeric(6,4) NOT NULL DEFAULT 0,
  churn_mensal numeric(6,4) NOT NULL DEFAULT 0,
  ticket_medio numeric(12,2),
  capacidade_maxima integer,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, ano, mes)
);

CREATE TABLE public.forecast_realizado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  mes integer NOT NULL,
  conversas_iniciadas integer,
  investimento_real numeric(12,2),
  base_inicial integer,
  base_final integer,
  cancelamentos integer,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, ano, mes)
);

CREATE TABLE public.forecast_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  mes integer NOT NULL,
  meta_alunos_ativos integer,
  meta_matriculas integer,
  cac_maximo numeric(12,2),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, ano, mes)
);

CREATE TABLE public.forecast_cenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  parametros jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecast_premissas TO authenticated;
GRANT ALL ON public.forecast_premissas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecast_realizado TO authenticated;
GRANT ALL ON public.forecast_realizado TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecast_metas TO authenticated;
GRANT ALL ON public.forecast_metas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecast_cenarios TO authenticated;
GRANT ALL ON public.forecast_cenarios TO service_role;

-- RLS
ALTER TABLE public.forecast_premissas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_realizado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_cenarios ENABLE ROW LEVEL SECURITY;

-- premissas
CREATE POLICY "forecast_premissas_select" ON public.forecast_premissas
  FOR SELECT TO authenticated
  USING (public.user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "forecast_premissas_insert" ON public.forecast_premissas
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "forecast_premissas_update" ON public.forecast_premissas
  FOR UPDATE TO authenticated
  USING (public.user_has_unidade_access(auth.uid(), unidade_id))
  WITH CHECK (public.user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "forecast_premissas_delete" ON public.forecast_premissas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- realizado
CREATE POLICY "forecast_realizado_select" ON public.forecast_realizado
  FOR SELECT TO authenticated
  USING (public.user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "forecast_realizado_insert" ON public.forecast_realizado
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "forecast_realizado_update" ON public.forecast_realizado
  FOR UPDATE TO authenticated
  USING (public.user_has_unidade_access(auth.uid(), unidade_id))
  WITH CHECK (public.user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "forecast_realizado_delete" ON public.forecast_realizado
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- metas
CREATE POLICY "forecast_metas_select" ON public.forecast_metas
  FOR SELECT TO authenticated
  USING (public.user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "forecast_metas_insert" ON public.forecast_metas
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "forecast_metas_update" ON public.forecast_metas
  FOR UPDATE TO authenticated
  USING (public.user_has_unidade_access(auth.uid(), unidade_id))
  WITH CHECK (public.user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "forecast_metas_delete" ON public.forecast_metas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- cenarios (privados por usuário)
CREATE POLICY "forecast_cenarios_select" ON public.forecast_cenarios
  FOR SELECT TO authenticated
  USING (
    public.user_has_unidade_access(auth.uid(), unidade_id)
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );
CREATE POLICY "forecast_cenarios_insert" ON public.forecast_cenarios
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_unidade_access(auth.uid(), unidade_id)
    AND created_by = auth.uid()
  );
CREATE POLICY "forecast_cenarios_update" ON public.forecast_cenarios
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "forecast_cenarios_delete" ON public.forecast_cenarios
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER trg_forecast_premissas_updated_at BEFORE UPDATE ON public.forecast_premissas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_forecast_realizado_updated_at BEFORE UPDATE ON public.forecast_realizado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_forecast_metas_updated_at BEFORE UPDATE ON public.forecast_metas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_forecast_cenarios_updated_at BEFORE UPDATE ON public.forecast_cenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- índices auxiliares
CREATE INDEX idx_forecast_premissas_unidade_periodo ON public.forecast_premissas (unidade_id, ano, mes);
CREATE INDEX idx_forecast_realizado_unidade_periodo ON public.forecast_realizado (unidade_id, ano, mes);
CREATE INDEX idx_forecast_metas_unidade_periodo ON public.forecast_metas (unidade_id, ano, mes);
CREATE INDEX idx_forecast_cenarios_unidade ON public.forecast_cenarios (unidade_id, created_by);