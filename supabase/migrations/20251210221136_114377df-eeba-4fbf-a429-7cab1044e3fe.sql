-- Create function to get user role from user_roles table
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE role
      WHEN 'admin' THEN 'admin'
      WHEN 'moderator' THEN 'recepcao'
      WHEN 'user' THEN 'comercial'
      ELSE NULL
    END
  FROM public.user_roles
  WHERE user_id = p_user_id
  LIMIT 1
$$;