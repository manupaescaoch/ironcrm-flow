-- Fix get_user_phone_by_name to check both 'name' and 'full_name' fields
CREATE OR REPLACE FUNCTION public.get_user_phone_by_name(p_name text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT up.telefone 
  FROM user_profiles up
  JOIN auth.users au ON au.id = up.user_id
  WHERE UPPER(COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '')) = UPPER(TRIM(p_name))
    AND up.telefone IS NOT NULL
    AND up.telefone != ''
  LIMIT 1
$function$;

-- Also fix find_user_by_name for consistency
CREATE OR REPLACE FUNCTION public.find_user_by_name(p_name text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM auth.users
  WHERE UPPER(COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')) = UPPER(TRIM(p_name))
  LIMIT 1
$function$;