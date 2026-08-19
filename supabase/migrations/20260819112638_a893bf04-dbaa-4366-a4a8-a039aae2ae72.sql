ALTER TABLE public.interacoes
  ADD COLUMN IF NOT EXISTS cancelado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

CREATE OR REPLACE FUNCTION public.validate_status_avaliacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status_avaliacao IS NOT NULL AND NEW.status_avaliacao NOT IN ('agendada', 'realizada', 'faltou', 'reagendada', 'cancelada') THEN
    RAISE EXCEPTION 'Invalid status_avaliacao value: %', NEW.status_avaliacao;
  END IF;
  RETURN NEW;
END;
$function$;