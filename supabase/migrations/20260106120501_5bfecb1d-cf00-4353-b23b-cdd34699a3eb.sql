-- Trigger para garantir que hora_experimental seja preenchida quando agendou_experimental = true
CREATE OR REPLACE FUNCTION public.validate_hora_experimental()
RETURNS TRIGGER AS $$
BEGIN
  -- Se está agendando experimental, hora_experimental é obrigatória
  IF NEW.agendou_experimental = true AND NEW.hora_experimental IS NULL THEN
    RAISE EXCEPTION 'hora_experimental é obrigatória quando agendou_experimental é true';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para INSERT e UPDATE
DROP TRIGGER IF EXISTS trigger_validate_hora_experimental ON public.interacoes;
CREATE TRIGGER trigger_validate_hora_experimental
  BEFORE INSERT OR UPDATE ON public.interacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_hora_experimental();