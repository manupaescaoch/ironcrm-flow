-- Função para atualizar cadastrado_por com bypass de triggers
CREATE OR REPLACE FUNCTION public.admin_update_cadastrador(old_name text, new_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_count integer;
BEGIN
  -- Set bypass flag
  PERFORM set_config('app.bypass_permissions', 'true', true);
  
  -- Update leads table
  UPDATE leads 
  SET cadastrado_por = new_name, updated_at = now()
  WHERE UPPER(TRIM(cadastrado_por)) = UPPER(TRIM(old_name));
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Update interacoes table as well
  UPDATE interacoes 
  SET cadastrado_por = new_name
  WHERE UPPER(TRIM(cadastrado_por)) = UPPER(TRIM(old_name));
  
  -- Reset bypass flag
  PERFORM set_config('app.bypass_permissions', 'false', true);
  
  RETURN affected_count;
END;
$$;