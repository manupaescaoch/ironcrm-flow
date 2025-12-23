-- Trigger function to sync unidade_id from lead to interacao
CREATE OR REPLACE FUNCTION public.sync_interacao_unidade_from_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead_unidade_id uuid;
BEGIN
  -- Get the unidade_id from the lead
  SELECT unidade_id INTO v_lead_unidade_id
  FROM leads
  WHERE id = NEW.lead_id;
  
  -- If lead exists, use its unidade_id
  IF v_lead_unidade_id IS NOT NULL THEN
    NEW.unidade_id := v_lead_unidade_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for INSERT on interacoes
DROP TRIGGER IF EXISTS trigger_sync_interacao_unidade ON interacoes;
CREATE TRIGGER trigger_sync_interacao_unidade
  BEFORE INSERT OR UPDATE ON interacoes
  FOR EACH ROW
  EXECUTE FUNCTION sync_interacao_unidade_from_lead();

-- Trigger function to sync unidade_id from lead to follow_ups
CREATE OR REPLACE FUNCTION public.sync_follow_up_unidade_from_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead_unidade_id uuid;
BEGIN
  -- Get the unidade_id from the lead
  SELECT unidade_id INTO v_lead_unidade_id
  FROM leads
  WHERE id = NEW.lead_id;
  
  -- If lead exists, use its unidade_id
  IF v_lead_unidade_id IS NOT NULL THEN
    NEW.unidade_id := v_lead_unidade_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for INSERT on follow_ups
DROP TRIGGER IF EXISTS trigger_sync_follow_up_unidade ON follow_ups;
CREATE TRIGGER trigger_sync_follow_up_unidade
  BEFORE INSERT OR UPDATE ON follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION sync_follow_up_unidade_from_lead();