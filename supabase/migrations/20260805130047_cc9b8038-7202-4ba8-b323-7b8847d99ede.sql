DROP POLICY IF EXISTS delete_own_leads_or_admin ON public.leads;

CREATE POLICY delete_leads_by_unidade ON public.leads
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.user_has_unidade_access(auth.uid(), unidade_id)
);

CREATE OR REPLACE FUNCTION public.enforce_leads_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.bypass_permissions', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF OLD.created_by = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Qualquer usuário autenticado com acesso à unidade do lead pode editar o lead
  IF public.user_has_unidade_access(auth.uid(), NEW.unidade_id)
     AND public.user_has_unidade_access(auth.uid(), OLD.unidade_id) THEN
    IF (NEW.status_funil IS DISTINCT FROM OLD.status_funil)
       AND (NEW.status_funil NOT IN ('novo', 'aula_agendada', 'aula_realizada', 'convertido', 'follow_up', 'perdido'))
    THEN
      RAISE EXCEPTION 'Operação não permitida: alteração de status não autorizada.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Operação não permitida: sem acesso à unidade.';
END;
$$;