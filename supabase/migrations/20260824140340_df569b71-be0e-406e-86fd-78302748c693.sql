-- Corrige âncora de fuso dos follow-ups: datas passam a ser meia-noite de Brasília
CREATE OR REPLACE FUNCTION public.generate_follow_ups_on_attendance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lead RECORD;
  v_data_experimental DATE;
  v_ref TIMESTAMPTZ;
BEGIN
  IF NEW.compareceu = true AND (OLD.compareceu IS NULL OR OLD.compareceu = false) THEN
    SELECT * INTO v_lead FROM leads WHERE id = NEW.lead_id;

    IF v_lead IS NULL OR v_lead.is_matriculado = true OR v_lead.status_funil = 'perdido' THEN
      RETURN NEW;
    END IF;

    v_data_experimental := COALESCE(NEW.data_experimental, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
    -- meia-noite de Brasília do dia da experimental
    v_ref := (v_data_experimental::timestamp AT TIME ZONE 'America/Sao_Paulo');

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'D+1', v_ref, ((v_data_experimental + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'), 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'D+7', v_ref, ((v_data_experimental + 7)::timestamp AT TIME ZONE 'America/Sao_Paulo'), 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'D+15', v_ref, ((v_data_experimental + 15)::timestamp AT TIME ZONE 'America/Sao_Paulo'), 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'D+30', v_ref, ((v_data_experimental + 30)::timestamp AT TIME ZONE 'America/Sao_Paulo'), 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_post_matricula_follow_ups()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_data_ref DATE;
  v_ref TIMESTAMPTZ;
BEGIN
  IF NEW.fechou_matricula = true AND (OLD.fechou_matricula IS NULL OR OLD.fechou_matricula = false) THEN
    v_data_ref := COALESCE(NEW.data_interacao::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
    v_ref := (v_data_ref::timestamp AT TIME ZONE 'America/Sao_Paulo');

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'M+7', v_ref, ((v_data_ref + 7)::timestamp AT TIME ZONE 'America/Sao_Paulo'), 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;

    INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista, status)
    VALUES (NEW.lead_id, NEW.unidade_id, 'M+30', v_ref, ((v_data_ref + 30)::timestamp AT TIME ZONE 'America/Sao_Paulo'), 'pendente')
    ON CONFLICT (lead_id, tipo) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Corrige registros pendentes existentes gravados com âncora UTC (21:00 BRT do dia anterior)
UPDATE public.follow_ups
SET data_prevista = data_prevista + INTERVAL '3 hours',
    data_referencia = CASE
      WHEN to_char(data_referencia AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') = '21:00'
      THEN data_referencia + INTERVAL '3 hours' ELSE data_referencia END,
    updated_at = now()
WHERE status IN ('pendente', 'enviando')
  AND to_char(data_prevista AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') = '21:00';