CREATE OR REPLACE FUNCTION public.can_manage_contas_pagar(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'user'::public.app_role, 'gerente'::public.app_role)
  )
$function$;