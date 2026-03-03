
-- Update escala INSERT policy
DROP POLICY IF EXISTS "insert_escala_admin" ON public.escala;
CREATE POLICY "insert_escala_admin_coord" ON public.escala
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role)
);

-- Update escala UPDATE policy
DROP POLICY IF EXISTS "update_escala_admin" ON public.escala;
CREATE POLICY "update_escala_admin_coord" ON public.escala
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role)
);

-- Update escala DELETE policy
DROP POLICY IF EXISTS "delete_escala_admin" ON public.escala;
CREATE POLICY "delete_escala_admin_coord" ON public.escala
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role)
);

-- Update get_user_role function to map coordenador
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    CASE role
      WHEN 'admin' THEN 'admin'
      WHEN 'moderator' THEN 'recepcao'
      WHEN 'user' THEN 'comercial'
      WHEN 'coordenador' THEN 'coordenador'
      ELSE NULL
    END
  FROM public.user_roles
  WHERE user_id = p_user_id
  LIMIT 1
$$;
