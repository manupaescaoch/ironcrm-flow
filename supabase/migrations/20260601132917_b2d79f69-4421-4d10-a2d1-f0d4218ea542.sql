ALTER TABLE public.anamneses_experimental
  ADD COLUMN IF NOT EXISTS notificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS notificacao_tentativas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notificacao_ultimo_erro text;

CREATE INDEX IF NOT EXISTS idx_anamneses_pendentes_notif
  ON public.anamneses_experimental (created_at)
  WHERE notificado_em IS NULL;