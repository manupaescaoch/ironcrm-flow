CREATE OR REPLACE FUNCTION public.admin_cleanup_duplicate_leads(lead_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$

;
CREATE OR REPLACE FUNCTION public.admin_standardize_origem(old_value text, new_value text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$

;
CREATE OR REPLACE FUNCTION public.admin_standardize_treinador(old_value text, new_value text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$

;
CREATE OR REPLACE FUNCTION public.admin_update_cadastrador(old_name text, new_name text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
;
