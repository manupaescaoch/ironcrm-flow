
-- Function to convert cadastrado_por and atendido_por to uppercase
CREATE OR REPLACE FUNCTION public.uppercase_cadastrado_atendido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Convert cadastrado_por to uppercase if present
  IF NEW.cadastrado_por IS NOT NULL THEN
    NEW.cadastrado_por := UPPER(NEW.cadastrado_por);
  END IF;
  
  -- Convert atendido_por to uppercase if present
  IF NEW.atendido_por IS NOT NULL THEN
    NEW.atendido_por := UPPER(NEW.atendido_por);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for leads table (run BEFORE the permission check trigger)
DROP TRIGGER IF EXISTS uppercase_leads_fields ON public.leads;
CREATE TRIGGER aaa_uppercase_leads_fields
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_cadastrado_atendido();

-- Trigger for interacoes table
DROP TRIGGER IF EXISTS uppercase_interacoes_fields ON public.interacoes;
CREATE TRIGGER uppercase_interacoes_fields
  BEFORE INSERT OR UPDATE ON public.interacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_cadastrado_atendido();
