CREATE OR REPLACE FUNCTION public.admin_cleanup_duplicate_leads(lead_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_count integer;
BEGIN
  PERFORM public.admin_assert_admin();
  -- Set a session variable to indicate admin bypass
  PERFORM set_config('app.bypass_permissions', 'true', true);
  
  -- Update leads to inactive
  UPDATE leads 
  SET ativo = false, updated_at = now()
  WHERE id = ANY(lead_ids);
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Reset the session variable
  PERFORM set_config('app.bypass_permissions', 'false', true);
  
  RETURN affected_count;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_standardize_origem(old_value text, new_value text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_count integer;
BEGIN
  PERFORM public.admin_assert_admin();
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
$function$
;
CREATE OR REPLACE FUNCTION public.admin_standardize_treinador(old_value text, new_value text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_count integer;
BEGIN
  PERFORM public.admin_assert_admin();
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
$function$
;
CREATE OR REPLACE FUNCTION public.admin_update_cadastrador(old_name text, new_name text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_count integer;
BEGIN
  PERFORM public.admin_assert_admin();
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
$function$
;
