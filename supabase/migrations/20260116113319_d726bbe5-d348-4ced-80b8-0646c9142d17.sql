-- 1. Cancel follow-ups for leads who never attended experimental
UPDATE follow_ups f
SET status = 'cancelado',
    cancelado_motivo = 'sem_comparecimento',
    updated_at = now()
WHERE f.status = 'pendente'
  AND NOT EXISTS (
    SELECT 1 FROM interacoes i 
    WHERE i.lead_id = f.lead_id 
      AND i.compareceu = true
  );

-- 2. Create trigger function to auto-generate follow-ups when attendance is marked
CREATE OR REPLACE FUNCTION generate_follow_ups_on_attendance()
RETURNS TRIGGER AS $$
DECLARE
  v_lead RECORD;
  v_data_experimental DATE;
BEGIN
  -- Only trigger when compareceu changes to true
  IF NEW.compareceu = true AND (OLD.compareceu IS NULL OR OLD.compareceu = false) THEN
    -- Get lead info
    SELECT * INTO v_lead FROM leads WHERE id = NEW.lead_id;
    
    -- Skip if lead is already matriculado or perdido
    IF v_lead IS NULL OR v_lead.is_matriculado = true OR v_lead.status_funil = 'perdido' THEN
      RETURN NEW;
    END IF;
    
    -- Use the experimental date from the interaction
    v_data_experimental := COALESCE(NEW.data_experimental, CURRENT_DATE);
    
    -- Insert D+1 follow-up
    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'D+1', v_data_experimental, v_data_experimental + INTERVAL '1 day', 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;
    
    -- Insert D+7 follow-up
    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'D+7', v_data_experimental, v_data_experimental + INTERVAL '7 days', 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;
    
    -- Insert D+15 follow-up
    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'D+15', v_data_experimental, v_data_experimental + INTERVAL '15 days', 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;
    
    -- Insert D+30 follow-up
    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'D+30', v_data_experimental, v_data_experimental + INTERVAL '30 days', 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create trigger on interacoes table
DROP TRIGGER IF EXISTS trigger_generate_follow_ups_on_attendance ON interacoes;
CREATE TRIGGER trigger_generate_follow_ups_on_attendance
  AFTER INSERT OR UPDATE OF compareceu ON interacoes
  FOR EACH ROW
  EXECUTE FUNCTION generate_follow_ups_on_attendance();