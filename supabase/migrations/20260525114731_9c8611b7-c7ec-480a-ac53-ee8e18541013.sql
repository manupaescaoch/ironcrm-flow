
CREATE TABLE IF NOT EXISTS public.formulario_envios_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  tipo_formulario text NOT NULL,
  unidade text NOT NULL,
  unidade_id uuid NULL,
  resposta_id uuid NULL,
  requested_by uuid NULL,
  origem text NOT NULL CHECK (origem IN ('crm_auth', 'public_form', 'internal_test')),
  status text NOT NULL CHECK (status IN ('enviado', 'duplicado', 'rate_limited', 'erro', 'sem_grupo', 'pendente')),
  destino_grupo_hash text NULL,
  payload_hash text NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_formulario_envios_log_ratelimit
  ON public.formulario_envios_log (tipo_formulario, unidade, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_formulario_envios_log_created_at
  ON public.formulario_envios_log (created_at DESC);

ALTER TABLE public.formulario_envios_log ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode visualizar
CREATE POLICY "Admins can view formulario envios log"
  ON public.formulario_envios_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Sem políticas de INSERT/UPDATE/DELETE: apenas service role grava (bypassa RLS).
