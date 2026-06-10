
-- Atualiza trigger de cancelamento para preservar M+*
CREATE OR REPLACE FUNCTION public.cancel_follow_ups_on_matricula()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.fechou_matricula = true AND (OLD.fechou_matricula IS NULL OR OLD.fechou_matricula = false) THEN
    UPDATE follow_ups 
    SET status = 'cancelado', 
        cancelado_motivo = 'matriculado',
        updated_at = now()
    WHERE lead_id = NEW.lead_id 
      AND status = 'pendente'
      AND tipo IN ('D+1','D+7','D+15','D+30');
  END IF;
  RETURN NEW;
END;
$function$;

-- Gera M+7 e M+30 ao registrar matrícula
CREATE OR REPLACE FUNCTION public.generate_post_matricula_follow_ups()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_data_ref DATE;
BEGIN
  IF NEW.fechou_matricula = true AND (OLD.fechou_matricula IS NULL OR OLD.fechou_matricula = false) THEN
    v_data_ref := COALESCE(NEW.data_interacao::date, CURRENT_DATE);

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'M+7', v_data_ref, v_data_ref + INTERVAL '7 days', 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'M+30', v_data_ref, v_data_ref + INTERVAL '30 days', 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_generate_post_matricula_follow_ups ON public.interacoes;
CREATE TRIGGER trg_generate_post_matricula_follow_ups
AFTER INSERT OR UPDATE OF fechou_matricula ON public.interacoes
FOR EACH ROW
EXECUTE FUNCTION public.generate_post_matricula_follow_ups();
