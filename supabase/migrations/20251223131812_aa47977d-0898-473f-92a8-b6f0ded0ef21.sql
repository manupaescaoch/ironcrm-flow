-- Função para normalizar telefone (remove caracteres não numéricos)
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN regexp_replace(phone, '[^0-9]', '', 'g');
END;
$$;

-- Função para verificar duplicados antes de inserir
CREATE OR REPLACE FUNCTION public.check_duplicate_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_phone text;
  existing_lead record;
BEGIN
  -- Normalizar telefone do novo lead
  normalized_phone := public.normalize_phone(NEW.telefone);
  
  -- Verificar se já existe lead ativo com o mesmo telefone normalizado
  SELECT id, nome, telefone INTO existing_lead
  FROM leads
  WHERE ativo = true
    AND public.normalize_phone(telefone) = normalized_phone
    AND (TG_OP = 'INSERT' OR id != NEW.id)
  LIMIT 1;
  
  IF FOUND THEN
    RAISE EXCEPTION 'Lead duplicado detectado: já existe um lead ativo com este telefone (%). Lead existente: % - %', 
      existing_lead.telefone, existing_lead.nome, existing_lead.id
      USING ERRCODE = 'unique_violation';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para verificar duplicados antes de INSERT
CREATE TRIGGER check_duplicate_lead_before_insert
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.check_duplicate_lead();

-- Criar trigger para verificar duplicados antes de UPDATE (caso mude o telefone)
CREATE TRIGGER check_duplicate_lead_before_update
BEFORE UPDATE OF telefone ON public.leads
FOR EACH ROW
WHEN (OLD.telefone IS DISTINCT FROM NEW.telefone)
EXECUTE FUNCTION public.check_duplicate_lead();