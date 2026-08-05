ALTER TABLE public.interacoes ADD COLUMN IF NOT EXISTS compareceu_em TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_compareceu_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.compareceu IS TRUE AND (TG_OP = 'INSERT' OR OLD.compareceu IS DISTINCT FROM TRUE) THEN
    NEW.compareceu_em := now();
  END IF;
  IF NEW.compareceu IS NOT TRUE THEN
    NEW.compareceu_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_compareceu_em ON public.interacoes;
CREATE TRIGGER trg_set_compareceu_em
BEFORE INSERT OR UPDATE OF compareceu ON public.interacoes
FOR EACH ROW EXECUTE FUNCTION public.set_compareceu_em();