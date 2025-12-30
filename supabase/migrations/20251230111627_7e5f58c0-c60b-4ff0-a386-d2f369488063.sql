CREATE OR REPLACE FUNCTION public.enforce_leads_update_permissions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check for admin bypass flag (used by admin cleanup functions)
  IF current_setting('app.bypass_permissions', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Admin can change anything
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Owner can change anything (keeps existing behavior)
  IF old.created_by = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Non-admin/non-owner: allow follow-up and funnel status updates
  IF (new.follow_up_whatsapp_enviado IS DISTINCT FROM old.follow_up_whatsapp_enviado)
     OR (new.follow_up_enviado_em IS DISTINCT FROM old.follow_up_enviado_em)
     OR (new.follow_up_responsavel IS DISTINCT FROM old.follow_up_responsavel)
     OR (new.status_funil IS DISTINCT FROM old.status_funil)
  THEN
    -- Permitir todos os status válidos do funil de vendas
    IF (new.status_funil IS DISTINCT FROM old.status_funil)
       AND (new.status_funil NOT IN ('novo', 'aula_agendada', 'aula_realizada', 'convertido', 'follow_up', 'perdido'))
    THEN
      RAISE EXCEPTION 'Operação não permitida: alteração de status não autorizada.';
    END IF;

    -- Ensure no other column changed
    IF (new.atendido_por IS DISTINCT FROM old.atendido_por)
      OR (new.ativo IS DISTINCT FROM old.ativo)
      OR (new.cadastrado_por IS DISTINCT FROM old.cadastrado_por)
      OR (new.created_at IS DISTINCT FROM old.created_at)
      OR (new.created_by IS DISTINCT FROM old.created_by)
      OR (new.data_aula_experimental IS DISTINCT FROM old.data_aula_experimental)
      OR (new.email IS DISTINCT FROM old.email)
      OR (new.hora_aula_experimental IS DISTINCT FROM old.hora_aula_experimental)
      OR (new.id IS DISTINCT FROM old.id)
      OR (new.nome IS DISTINCT FROM old.nome)
      OR (new.observacoes IS DISTINCT FROM old.observacoes)
      OR (new.origem IS DISTINCT FROM old.origem)
      OR (new.plano_escolhido IS DISTINCT FROM old.plano_escolhido)
      OR (new.telefone IS DISTINCT FROM old.telefone)
      OR (new.user_id IS DISTINCT FROM old.user_id)
    THEN
      RAISE EXCEPTION 'Operação não permitida: você só pode atualizar informações de follow up.';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Operação não permitida.';
END;
$function$;