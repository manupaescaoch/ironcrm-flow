-- 1. forecast_realizado: novos campos
ALTER TABLE public.forecast_realizado
  ADD COLUMN IF NOT EXISTS leads_crm integer,
  ADD COLUMN IF NOT EXISTS experimentais_marcadas integer,
  ADD COLUMN IF NOT EXISTS comparecimentos integer,
  ADD COLUMN IF NOT EXISTS matriculas_total integer,
  ADD COLUMN IF NOT EXISTS matriculas_trafego integer,
  ADD COLUMN IF NOT EXISTS ticket_medio numeric,
  ADD COLUMN IF NOT EXISTS alunos_ativos integer,
  ADD COLUMN IF NOT EXISTS fechado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fechado_em timestamptz,
  ADD COLUMN IF NOT EXISTS fechado_por uuid;

CREATE UNIQUE INDEX IF NOT EXISTS forecast_realizado_unidade_mes_ano_key
  ON public.forecast_realizado (unidade_id, ano, mes);

-- 2. forecast_premissas: novos campos
ALTER TABLE public.forecast_premissas
  ADD COLUMN IF NOT EXISTS meta_alunos integer,
  ADD COLUMN IF NOT EXISTS cpl_projetado numeric,
  ADD COLUMN IF NOT EXISTS mensalidade_media numeric,
  ADD COLUMN IF NOT EXISTS base_inicial integer,
  ADD COLUMN IF NOT EXISTS aproveitamento_atendimento numeric;

CREATE UNIQUE INDEX IF NOT EXISTS forecast_premissas_unidade_mes_ano_key
  ON public.forecast_premissas (unidade_id, ano, mes);

CREATE UNIQUE INDEX IF NOT EXISTS forecast_metas_unidade_mes_ano_key
  ON public.forecast_metas (unidade_id, ano, mes);

-- 3. Acompanhamento semanal
CREATE TABLE IF NOT EXISTS public.forecast_semanal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  semana_inicio date NOT NULL,
  alunos_segunda integer NOT NULL DEFAULT 0,
  matriculas integer NOT NULL DEFAULT 0,
  cancelamentos integer NOT NULL DEFAULT 0,
  alunos_sexta integer,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, semana_inicio)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecast_semanal TO authenticated;
GRANT ALL ON public.forecast_semanal TO service_role;
ALTER TABLE public.forecast_semanal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forecast_semanal_admin_all ON public.forecast_semanal;
CREATE POLICY forecast_semanal_admin_all ON public.forecast_semanal
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER forecast_semanal_updated_at
  BEFORE UPDATE ON public.forecast_semanal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Acesso admin-only nas tabelas de forecast
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['forecast_realizado','forecast_premissas','forecast_metas','forecast_cenarios']
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'))$f$, t || '_admin_all', t);
  END LOOP;
END $$;

-- 5. Proteger mês fechado
CREATE OR REPLACE FUNCTION public.protect_forecast_mes_fechado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.fechado AND NEW.fechado THEN
    RAISE EXCEPTION 'Mês já fechado. Reabra o mês antes de alterar os dados.';
  END IF;
  IF OLD.fechado AND NOT NEW.fechado AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem reabrir um mês fechado.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_forecast_realizado_fechado ON public.forecast_realizado;
CREATE TRIGGER protect_forecast_realizado_fechado
  BEFORE UPDATE ON public.forecast_realizado
  FOR EACH ROW EXECUTE FUNCTION public.protect_forecast_mes_fechado();