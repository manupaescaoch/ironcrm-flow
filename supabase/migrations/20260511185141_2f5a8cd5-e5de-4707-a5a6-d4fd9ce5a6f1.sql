DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'confirmacao-experimental-cron';

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_leads_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  IF (NEW.follow_up_whatsapp_enviado IS DISTINCT FROM OLD.follow_up_whatsapp_enviado)
     OR (NEW.follow_up_enviado_em IS DISTINCT FROM OLD.follow_up_enviado_em)
     OR (NEW.follow_up_responsavel IS DISTINCT FROM OLD.follow_up_responsavel)
     OR (NEW.status_funil IS DISTINCT FROM OLD.status_funil)
     OR (NEW.is_matriculado IS DISTINCT FROM OLD.is_matriculado)
     OR (NEW.confirmacao_24h_enviada_em IS DISTINCT FROM OLD.confirmacao_24h_enviada_em)
     OR (NEW.confirmacao_2h_enviada_em IS DISTINCT FROM OLD.confirmacao_2h_enviada_em)
  THEN
    IF (NEW.status_funil IS DISTINCT FROM OLD.status_funil)
       AND (NEW.status_funil NOT IN ('novo', 'aula_agendada', 'aula_realizada', 'convertido', 'follow_up', 'perdido'))
    THEN
      RAISE EXCEPTION 'Operação não permitida: alteração de status não autorizada.';
    END IF;

    IF (NEW.atendido_por IS DISTINCT FROM OLD.atendido_por)
      OR (NEW.ativo IS DISTINCT FROM OLD.ativo)
      OR (NEW.cadastrado_por IS DISTINCT FROM OLD.cadastrado_por)
      OR (NEW.created_at IS DISTINCT FROM OLD.created_at)
      OR (NEW.created_by IS DISTINCT FROM OLD.created_by)
      OR (NEW.data_aula_experimental IS DISTINCT FROM OLD.data_aula_experimental)
      OR (NEW.email IS DISTINCT FROM OLD.email)
      OR (NEW.hora_aula_experimental IS DISTINCT FROM OLD.hora_aula_experimental)
      OR (NEW.id IS DISTINCT FROM OLD.id)
      OR (NEW.nome IS DISTINCT FROM OLD.nome)
      OR (NEW.observacoes IS DISTINCT FROM OLD.observacoes)
      OR (NEW.origem IS DISTINCT FROM OLD.origem)
      OR (NEW.plano_escolhido IS DISTINCT FROM OLD.plano_escolhido)
      OR (NEW.telefone IS DISTINCT FROM OLD.telefone)
      OR (NEW.user_id IS DISTINCT FROM OLD.user_id)
    THEN
      RAISE EXCEPTION 'Operação não permitida: você só pode atualizar informações de follow up.';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Operação não permitida.';
END;
$$;