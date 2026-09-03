CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and (
        role = _role
        -- Gerente herda as permissões de coordenador e de comercial ('user')
        or (role = 'gerente'::app_role and _role in ('coordenador'::app_role, 'user'::app_role))
      )
  )
$$;