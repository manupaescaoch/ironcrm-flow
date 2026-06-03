CREATE OR REPLACE FUNCTION public.set_lead_telefone_normalizado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.telefone IS NULL THEN
    NEW.telefone_normalizado := NULL;
  ELSE
    NEW.telefone_normalizado := NULLIF(regexp_replace(NEW.telefone, '\D', '', 'g'), '');
  END IF;
  RETURN NEW;
END;
$$;