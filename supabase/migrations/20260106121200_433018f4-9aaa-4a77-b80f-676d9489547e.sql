-- Corrigir search_path da função validate_hora_experimental
CREATE OR REPLACE FUNCTION public.validate_hora_experimental()
RETURNS TRIGGER AS $$
BEGIN
  -- Se está agendando experimental, hora_experimental é obrigatória
  IF NEW.agendou_experimental = true AND NEW.hora_experimental IS NULL THEN
    RAISE EXCEPTION 'hora_experimental é obrigatória quando agendou_experimental é true';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;