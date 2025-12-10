-- Fix existing functions to set search_path for security
CREATE OR REPLACE FUNCTION public.validate_status_funil()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.status_funil NOT IN ('novo', 'contato_inicial', 'aula_agendada', 'aula_realizada', 'negociacao', 'convertido', 'perdido') THEN
    RAISE EXCEPTION 'Invalid status_funil value: %', NEW.status_funil;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_plano_escolhido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.plano_escolhido IS NOT NULL AND NEW.plano_escolhido NOT IN ('Executivo Mensal', 'Mensal', 'Trimestral', 'Semestral', 'Anual', 'Executivo Anual') THEN
    RAISE EXCEPTION 'Invalid plano_escolhido value: %', NEW.plano_escolhido;
  END IF;
  RETURN NEW;
END;
$function$;