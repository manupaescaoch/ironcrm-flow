CREATE OR REPLACE FUNCTION public.validate_nps_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('novo','em_contato','concluido') THEN
    RAISE EXCEPTION 'status NPS inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END $$;