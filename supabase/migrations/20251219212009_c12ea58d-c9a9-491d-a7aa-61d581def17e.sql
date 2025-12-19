-- Adicionar colunas para Avaliação Física na tabela interacoes
ALTER TABLE public.interacoes 
ADD COLUMN IF NOT EXISTS data_avaliacao date,
ADD COLUMN IF NOT EXISTS hora_avaliacao time,
ADD COLUMN IF NOT EXISTS status_avaliacao text;

-- Adicionar constraint para validar status_avaliacao
CREATE OR REPLACE FUNCTION public.validate_status_avaliacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status_avaliacao IS NOT NULL AND NEW.status_avaliacao NOT IN ('agendada', 'realizada', 'faltou', 'reagendada') THEN
    RAISE EXCEPTION 'Invalid status_avaliacao value: %', NEW.status_avaliacao;
  END IF;
  RETURN NEW;
END;
$function$;

-- Criar trigger para validação
DROP TRIGGER IF EXISTS validate_status_avaliacao_trigger ON public.interacoes;
CREATE TRIGGER validate_status_avaliacao_trigger
  BEFORE INSERT OR UPDATE ON public.interacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_status_avaliacao();