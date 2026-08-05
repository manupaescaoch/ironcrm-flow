CREATE OR REPLACE FUNCTION public.enforce_leads_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Rotinas de backend (edge functions / cron) rodam sem usuário autenticado
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.bypass_permissions', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF OLD.created_by = auth.uid() THEN
    RETURN NEW;
  END IF;

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

UPDATE public.leads
SET confirmacao_24h_enviada_em = now()
WHERE id = 'f030d2d1-7663-43ff-8518-b6400b302b3d'
  AND confirmacao_24h_enviada_em IS NULL;