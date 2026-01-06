
-- Trigger para sincronizar hora_experimental da interação com hora_aula_experimental do lead
-- Executa quando uma interação é inserida ou atualizada com data_experimental

CREATE OR REPLACE FUNCTION sync_hora_experimental_from_lead()
RETURNS TRIGGER AS $$
DECLARE
  lead_hora TIME;
BEGIN
  -- Só sincroniza se a interação tem data_experimental definida
  IF NEW.data_experimental IS NOT NULL THEN
    -- Busca a hora do lead
    SELECT hora_aula_experimental INTO lead_hora
    FROM leads
    WHERE id = NEW.lead_id;
    
    -- Se o lead tem hora definida, usa ela na interação
    IF lead_hora IS NOT NULL THEN
      NEW.hora_experimental := lead_hora;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para INSERT e UPDATE em interacoes
DROP TRIGGER IF EXISTS trigger_sync_hora_experimental ON interacoes;
CREATE TRIGGER trigger_sync_hora_experimental
BEFORE INSERT OR UPDATE OF data_experimental, hora_experimental ON interacoes
FOR EACH ROW
EXECUTE FUNCTION sync_hora_experimental_from_lead();

-- Trigger inverso: quando o lead é atualizado, sincroniza as interações futuras
CREATE OR REPLACE FUNCTION sync_interacoes_hora_from_lead()
RETURNS TRIGGER AS $$
BEGIN
  -- Só atualiza se o horário mudou
  IF NEW.hora_aula_experimental IS DISTINCT FROM OLD.hora_aula_experimental THEN
    -- Atualiza interações futuras (data_experimental >= hoje)
    UPDATE interacoes
    SET hora_experimental = NEW.hora_aula_experimental
    WHERE lead_id = NEW.id
      AND data_experimental >= CURRENT_DATE
      AND hora_experimental IS DISTINCT FROM NEW.hora_aula_experimental;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para UPDATE em leads
DROP TRIGGER IF EXISTS trigger_sync_interacoes_hora ON leads;
CREATE TRIGGER trigger_sync_interacoes_hora
AFTER UPDATE OF hora_aula_experimental ON leads
FOR EACH ROW
EXECUTE FUNCTION sync_interacoes_hora_from_lead();
