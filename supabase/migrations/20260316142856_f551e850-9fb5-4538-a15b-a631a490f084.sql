
CREATE OR REPLACE FUNCTION public.inativar_aluno(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow authenticated users with access to the lead's unidade
  IF NOT EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = p_lead_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'coordenador'::app_role)
      OR l.created_by = auth.uid()
      OR public.user_has_unidade_access(auth.uid(), l.unidade_id)
    )
  ) THEN
    RAISE EXCEPTION 'Permissão negada para inativar este aluno.';
  END IF;

  -- Set bypass to skip the trigger check
  PERFORM set_config('app.bypass_permissions', 'true', true);
  
  UPDATE leads
  SET ativo = false, updated_at = now()
  WHERE id = p_lead_id;
  
  PERFORM set_config('app.bypass_permissions', 'false', true);
END;
$$;
