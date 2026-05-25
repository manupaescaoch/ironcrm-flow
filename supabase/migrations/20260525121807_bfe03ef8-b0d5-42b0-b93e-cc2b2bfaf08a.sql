
-- Defense-in-depth: prevent authenticated users from probing other users' roles/units via RPC.
-- RLS policies always pass auth.uid() so behavior is unchanged in policy evaluation context.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND (
        _user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles a
          WHERE a.user_id = auth.uid() AND a.role = 'admin'
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_unidades(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT uu.unidade_id
  FROM public.user_unidades uu
  WHERE uu.user_id = _user_id
    AND (
      _user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles a
        WHERE a.user_id = auth.uid() AND a.role = 'admin'
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.user_has_unidade_access(_user_id uuid, _unidade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    _user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles a
      WHERE a.user_id = auth.uid() AND a.role = 'admin'
    )
  )
  AND (
    EXISTS (
      SELECT 1
      FROM public.user_unidades
      WHERE user_id = _user_id
        AND unidade_id = _unidade_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'admin'
    )
  )
$$;
