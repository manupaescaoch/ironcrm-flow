-- Add is_matriculado field to leads table
ALTER TABLE leads ADD COLUMN is_matriculado boolean NOT NULL DEFAULT false;

-- Add cancelado_motivo field to follow_ups table
ALTER TABLE follow_ups ADD COLUMN cancelado_motivo text;

-- Create function to update leads.is_matriculado when matrícula is registered
CREATE OR REPLACE FUNCTION public.update_lead_matriculado_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.fechou_matricula = true AND (OLD.fechou_matricula IS NULL OR OLD.fechou_matricula = false) THEN
    -- Use bypass to allow updating is_matriculado
    PERFORM set_config('app.bypass_permissions', 'true', true);
    UPDATE leads 
    SET is_matriculado = true, updated_at = now()
    WHERE id = NEW.lead_id;
    PERFORM set_config('app.bypass_permissions', 'false', true);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to update is_matriculado
CREATE TRIGGER trigger_update_lead_matriculado
AFTER INSERT OR UPDATE OF fechou_matricula ON interacoes
FOR EACH ROW
EXECUTE FUNCTION update_lead_matriculado_status();

-- Update cancel_follow_ups_on_matricula to include cancelado_motivo
CREATE OR REPLACE FUNCTION public.cancel_follow_ups_on_matricula()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.fechou_matricula = true AND (OLD.fechou_matricula IS NULL OR OLD.fechou_matricula = false) THEN
    UPDATE follow_ups 
    SET status = 'cancelado', 
        cancelado_motivo = 'matriculado',
        updated_at = now()
    WHERE lead_id = NEW.lead_id AND status = 'pendente';
  END IF;
  RETURN NEW;
END;
$$;

-- Update enforce_leads_update_permissions to allow is_matriculado changes via trigger
CREATE OR REPLACE FUNCTION public.enforce_leads_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check for admin bypass flag (used by admin cleanup functions and triggers)
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

  -- Non-admin/non-owner: allow follow-up, funnel status, and is_matriculado updates
  IF (new.follow_up_whatsapp_enviado IS DISTINCT FROM old.follow_up_whatsapp_enviado)
     OR (new.follow_up_enviado_em IS DISTINCT FROM old.follow_up_enviado_em)
     OR (new.follow_up_responsavel IS DISTINCT FROM old.follow_up_responsavel)
     OR (new.status_funil IS DISTINCT FROM old.status_funil)
     OR (new.is_matriculado IS DISTINCT FROM old.is_matriculado)
  THEN
    -- Permitir todos os status válidos do funil de vendas
    IF (new.status_funil IS DISTINCT FROM old.status_funil)
       AND (new.status_funil NOT IN ('novo', 'aula_agendada', 'aula_realizada', 'convertido', 'follow_up', 'perdido'))
    THEN
      RAISE EXCEPTION 'Operação não permitida: alteração de status não autorizada.';
    END IF;

    -- Ensure no other column changed (except is_matriculado which is allowed)
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
$$;