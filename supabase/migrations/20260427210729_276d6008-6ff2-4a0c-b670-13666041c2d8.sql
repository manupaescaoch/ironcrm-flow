CREATE OR REPLACE FUNCTION public.update_lead_status_on_matricula()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fechou_matricula = true THEN
    PERFORM set_config('app.bypass_permissions', 'true', true);
    UPDATE leads
    SET status_funil = 'convertido', updated_at = now()
    WHERE id = NEW.lead_id
      AND status_funil NOT IN ('convertido', 'perdido');
    PERFORM set_config('app.bypass_permissions', 'false', true);
  END IF;
  RETURN NEW;
END;
$function$;