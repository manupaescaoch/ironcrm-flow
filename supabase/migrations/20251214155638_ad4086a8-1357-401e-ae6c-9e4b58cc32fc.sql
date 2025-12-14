
-- 1. Add new columns to leads table for follow-up tracking
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS follow_up_whatsapp_enviado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS follow_up_enviado_em timestamp with time zone,
ADD COLUMN IF NOT EXISTS follow_up_responsavel text;

-- 2. Update the status_funil validation trigger to include 'follow_up'
CREATE OR REPLACE FUNCTION public.validate_status_funil()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status_funil NOT IN ('novo', 'contato_inicial', 'aula_agendada', 'aula_realizada', 'negociacao', 'convertido', 'perdido', 'follow_up') THEN
    RAISE EXCEPTION 'Invalid status_funil value: %', NEW.status_funil;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Create index for follow-up queries performance
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON public.leads (status_funil, follow_up_whatsapp_enviado) WHERE status_funil = 'follow_up';
