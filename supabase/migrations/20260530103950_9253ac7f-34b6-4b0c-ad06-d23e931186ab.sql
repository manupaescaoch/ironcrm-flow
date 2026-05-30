
-- Tabela de metas por unidade
CREATE TABLE public.gestao_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL UNIQUE REFERENCES public.unidades(id) ON DELETE CASCADE,
  capacidade_alunos integer NOT NULL DEFAULT 0,
  meta_ocupacao_pct numeric(5,2) NOT NULL DEFAULT 80,
  meta_matriculas_semana integer NOT NULL DEFAULT 0,
  meta_receita_mes numeric(12,2) NOT NULL DEFAULT 0,
  meta_taxa_comparecimento_pct numeric(5,2) NOT NULL DEFAULT 75,
  meta_taxa_conversao_pct numeric(5,2) NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_metas TO authenticated;
GRANT ALL ON public.gestao_metas TO service_role;

ALTER TABLE public.gestao_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode tudo em gestao_metas"
  ON public.gestao_metas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_gestao_metas_updated_at
  BEFORE UPDATE ON public.gestao_metas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de lançamentos semanais
CREATE TABLE public.gestao_lancamentos_semanais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  semana_referencia date NOT NULL,
  total_alunos_ativos integer NOT NULL DEFAULT 0,
  experimentais_agendados integer NOT NULL DEFAULT 0,
  comparecimentos integer NOT NULL DEFAULT 0,
  matriculas_fechadas integer NOT NULL DEFAULT 0,
  cancelamentos integer NOT NULL DEFAULT 0,
  follow_ups_pendentes integer NOT NULL DEFAULT 0,
  receita_semana numeric(12,2) NOT NULL DEFAULT 0,
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unidade_id, semana_referencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_lancamentos_semanais TO authenticated;
GRANT ALL ON public.gestao_lancamentos_semanais TO service_role;

ALTER TABLE public.gestao_lancamentos_semanais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode tudo em lancamentos_semanais"
  ON public.gestao_lancamentos_semanais FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_gestao_lancamentos_updated_at
  BEFORE UPDATE ON public.gestao_lancamentos_semanais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lancamentos_unidade_semana
  ON public.gestao_lancamentos_semanais(unidade_id, semana_referencia DESC);

-- Seed das metas iniciais (ZN: 450, ZS: 3000, ambas 80% ocupação)
INSERT INTO public.gestao_metas (unidade_id, capacidade_alunos, meta_ocupacao_pct)
SELECT id, CASE WHEN slug ILIKE '%norte%' OR nome ILIKE '%norte%' THEN 450 ELSE 3000 END, 80
FROM public.unidades
WHERE nome ILIKE '%Iron%'
ON CONFLICT (unidade_id) DO NOTHING;
