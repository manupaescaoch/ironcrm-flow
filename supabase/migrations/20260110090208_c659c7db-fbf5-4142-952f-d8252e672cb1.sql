-- Função para cancelar follow-ups quando matrícula é registrada
CREATE OR REPLACE FUNCTION public.cancel_follow_ups_on_matricula()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se fechou_matricula mudou para true, cancelar todos os follow-ups pendentes
  IF NEW.fechou_matricula = true AND (OLD.fechou_matricula IS NULL OR OLD.fechou_matricula = false) THEN
    UPDATE follow_ups 
    SET status = 'cancelado', updated_at = now()
    WHERE lead_id = NEW.lead_id AND status = 'pendente';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger que dispara quando fechou_matricula é atualizado
CREATE TRIGGER trigger_cancel_follow_ups_on_matricula
AFTER INSERT OR UPDATE OF fechou_matricula ON interacoes
FOR EACH ROW
EXECUTE FUNCTION cancel_follow_ups_on_matricula();