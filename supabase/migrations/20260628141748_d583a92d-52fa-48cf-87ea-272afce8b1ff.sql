
ALTER TABLE public.nps_respostas
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_nome text;

CREATE INDEX IF NOT EXISTS idx_nps_respostas_lead_id ON public.nps_respostas(lead_id);
CREATE INDEX IF NOT EXISTS idx_nps_respostas_created_at ON public.nps_respostas(created_at DESC);

CREATE OR REPLACE FUNCTION public.set_nps_lead_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_phone text;
  v_lead record;
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_phone := regexp_replace(COALESCE(NEW.whatsapp, ''), '\D', '', 'g');
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RETURN NEW;
  END IF;

  SELECT id, nome INTO v_lead
  FROM public.leads
  WHERE ativo = true
    AND (NEW.unidade_id IS NULL OR unidade_id = NEW.unidade_id)
    AND public.normalize_phone(telefone) = v_phone
  ORDER BY is_matriculado DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF FOUND THEN
    NEW.lead_id := v_lead.id;
    IF NEW.lead_nome IS NULL THEN
      NEW.lead_nome := v_lead.nome;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_nps_lead_link ON public.nps_respostas;
CREATE TRIGGER trg_set_nps_lead_link
  BEFORE INSERT ON public.nps_respostas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_nps_lead_link();
