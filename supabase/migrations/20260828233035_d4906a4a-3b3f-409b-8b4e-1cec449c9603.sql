ALTER TABLE public.nps_respostas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS acao_corretiva TEXT,
  ADD COLUMN IF NOT EXISTS prazo DATE;

CREATE OR REPLACE FUNCTION public.validate_nps_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('novo','em_contato','concluido') THEN
    RAISE EXCEPTION 'status NPS inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_nps_status ON public.nps_respostas;
CREATE TRIGGER trg_validate_nps_status BEFORE INSERT OR UPDATE ON public.nps_respostas
FOR EACH ROW EXECUTE FUNCTION public.validate_nps_status();