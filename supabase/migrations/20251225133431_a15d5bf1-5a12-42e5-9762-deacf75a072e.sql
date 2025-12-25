
-- Função para padronizar origens de leads (bypass de permissões para admin)
CREATE OR REPLACE FUNCTION public.admin_standardize_origem(old_value text, new_value text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  affected_count integer;
BEGIN
  -- Set bypass flag
  PERFORM set_config('app.bypass_permissions', 'true', true);
  
  -- Update leads table
  UPDATE leads 
  SET origem = new_value, updated_at = now()
  WHERE UPPER(TRIM(origem)) = UPPER(TRIM(old_value));
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Reset bypass flag
  PERFORM set_config('app.bypass_permissions', 'false', true);
  
  RETURN affected_count;
END;
$function$;

-- Função para padronizar nomes de treinadores
CREATE OR REPLACE FUNCTION public.admin_standardize_treinador(old_value text, new_value text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  affected_count integer;
BEGIN
  -- Update interacoes table
  UPDATE interacoes 
  SET treinador_responsavel = new_value
  WHERE UPPER(TRIM(treinador_responsavel)) = UPPER(TRIM(old_value));
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Also update treinador_experimental if exists
  UPDATE interacoes 
  SET treinador_experimental = new_value
  WHERE UPPER(TRIM(treinador_experimental)) = UPPER(TRIM(old_value));
  
  RETURN affected_count;
END;
$function$;
