-- Colunas para controle de envio das confirmações automáticas
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS confirmacao_24h_enviada_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS confirmacao_2h_enviada_em timestamp with time zone;

-- Trigger: ao reagendar (mudou data ou hora), reseta os flags
CREATE OR REPLACE FUNCTION public.reset_confirmacao_experimental_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.data_aula_experimental IS DISTINCT FROM OLD.data_aula_experimental)
     OR (NEW.hora_aula_experimental IS DISTINCT FROM OLD.hora_aula_experimental) THEN
    NEW.confirmacao_24h_enviada_em := NULL;
    NEW.confirmacao_2h_enviada_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_confirmacao_experimental ON public.leads;
CREATE TRIGGER trg_reset_confirmacao_experimental
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.reset_confirmacao_experimental_flags();

-- Índice para busca eficiente do cron
CREATE INDEX IF NOT EXISTS idx_leads_confirmacao_experimental
  ON public.leads (data_aula_experimental, hora_aula_experimental)
  WHERE ativo = true AND is_matriculado = false
    AND data_aula_experimental IS NOT NULL
    AND hora_aula_experimental IS NOT NULL;