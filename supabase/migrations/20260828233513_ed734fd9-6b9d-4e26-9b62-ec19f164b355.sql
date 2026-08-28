CREATE OR REPLACE FUNCTION public.set_nps_unidade_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_nome text;
BEGIN
  IF NEW.unidade_id IS NULL AND NEW.unidade_nome IS NOT NULL THEN
    v_nome := upper(btrim(regexp_replace(NEW.unidade_nome, '^(EVO|IRON)\s+', '', 'i')));
    SELECT id INTO NEW.unidade_id
    FROM public.unidades
    WHERE upper(btrim(regexp_replace(nome, '^(EVO|IRON)\s+', '', 'i'))) = v_nome
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.nps_respostas r
SET unidade_id = u.id
FROM public.unidades u
WHERE r.unidade_id IS NULL
  AND upper(btrim(regexp_replace(u.nome, '^(EVO|IRON)\s+', '', 'i')))
      = upper(btrim(regexp_replace(r.unidade_nome, '^(EVO|IRON)\s+', '', 'i')));