
-- Trigger 1: cancela follow-ups quando "compareceu" é desmarcado (true -> false)
CREATE OR REPLACE FUNCTION public.cancel_follow_ups_on_compareceu_undone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.compareceu = true AND (NEW.compareceu IS NULL OR NEW.compareceu = false) THEN
    UPDATE follow_ups
    SET status = 'cancelado',
        cancelado_motivo = 'compareceu_desmarcado',
        concluido_em = now(),
        concluido_por = 'SISTEMA (compareceu desmarcado)',
        updated_at = now()
    WHERE lead_id = NEW.lead_id
      AND status = 'pendente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_follow_ups_on_compareceu_undone ON public.interacoes;
CREATE TRIGGER trg_cancel_follow_ups_on_compareceu_undone
AFTER UPDATE OF compareceu ON public.interacoes
FOR EACH ROW
EXECUTE FUNCTION public.cancel_follow_ups_on_compareceu_undone();

-- Trigger 2: cancela follow-ups pendentes quando o lead é reagendado
-- (nova interação com agendou_experimental = true e data_experimental futura)
CREATE OR REPLACE FUNCTION public.cancel_follow_ups_on_reschedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.agendou_experimental = true
     AND NEW.data_experimental IS NOT NULL
     AND NEW.data_experimental >= CURRENT_DATE
     AND COALESCE(NEW.compareceu, false) = false THEN
    UPDATE follow_ups
    SET status = 'cancelado',
        cancelado_motivo = 'reagendado',
        concluido_em = now(),
        concluido_por = 'SISTEMA (reagendado)',
        updated_at = now()
    WHERE lead_id = NEW.lead_id
      AND status = 'pendente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_follow_ups_on_reschedule ON public.interacoes;
CREATE TRIGGER trg_cancel_follow_ups_on_reschedule
AFTER INSERT ON public.interacoes
FOR EACH ROW
EXECUTE FUNCTION public.cancel_follow_ups_on_reschedule();
