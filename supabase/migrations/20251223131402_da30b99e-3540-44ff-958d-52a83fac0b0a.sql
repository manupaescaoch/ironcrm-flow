-- Criar função para limpeza de duplicados com bypass de triggers
CREATE OR REPLACE FUNCTION public.admin_cleanup_duplicate_leads(lead_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_count integer;
BEGIN
  -- Desabilitar temporariamente o trigger
  ALTER TABLE leads DISABLE TRIGGER ALL;
  
  -- Atualizar leads para inativos
  UPDATE leads 
  SET ativo = false, updated_at = now()
  WHERE id = ANY(lead_ids);
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Reabilitar triggers
  ALTER TABLE leads ENABLE TRIGGER ALL;
  
  RETURN affected_count;
END;
$$;