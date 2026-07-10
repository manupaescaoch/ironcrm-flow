ALTER TABLE public.whatsapp_envios_log
  ADD COLUMN IF NOT EXISTS status_envio text,
  ADD COLUMN IF NOT EXISTS resposta_completa jsonb;

CREATE INDEX IF NOT EXISTS idx_whatsapp_envios_log_status_envio
  ON public.whatsapp_envios_log(status_envio, created_at DESC);