
-- Faz o check_duplicate_lead respeitar o bypass já usado em rotinas administrativas
CREATE OR REPLACE FUNCTION public.check_duplicate_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  normalized_phone text;
  existing_lead record;
BEGIN
  IF current_setting('app.bypass_permissions', true) = 'true' THEN
    RETURN NEW;
  END IF;

  normalized_phone := public.normalize_phone(NEW.telefone);

  IF normalized_phone IS NULL OR normalized_phone = '' THEN
    RETURN NEW;
  END IF;

  SELECT id, nome, telefone INTO existing_lead
  FROM leads
  WHERE ativo = true
    AND unidade_id IS NOT DISTINCT FROM NEW.unidade_id
    AND public.normalize_phone(telefone) = normalized_phone
    AND (TG_OP = 'INSERT' OR id != NEW.id)
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Lead duplicado detectado: já existe um lead ativo com este telefone (%) nesta unidade. Lead existente: % - %',
      existing_lead.telefone, existing_lead.nome, existing_lead.id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill dos telefones antigos com máscara
DO $$
BEGIN
  PERFORM set_config('app.bypass_permissions', 'true', true);
  UPDATE public.leads
  SET telefone = NULLIF(regexp_replace(telefone, '\D', '', 'g'), ''),
      telefone_normalizado = NULLIF(regexp_replace(telefone, '\D', '', 'g'), '')
  WHERE telefone IS NOT NULL
    AND telefone ~ '\D';
  PERFORM set_config('app.bypass_permissions', 'false', true);
END $$;
