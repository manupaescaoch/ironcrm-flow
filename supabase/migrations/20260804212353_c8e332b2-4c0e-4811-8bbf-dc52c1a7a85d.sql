-- Padronização canônica de telefone
CREATE OR REPLACE FUNCTION public.canonical_phone(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d text;
BEGIN
  IF phone IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(phone, '[^0-9]', '', 'g');
  IF d = '' THEN RETURN NULL; END IF;

  -- remove prefixo internacional 55 quando o resto tem 10 ou 11 dígitos
  IF length(d) IN (12, 13) AND left(d, 2) = '55' THEN
    d := substring(d from 3);
  END IF;

  -- completa o 9 do celular: 10 dígitos (DDD + 8) -> DDD + 9 + 8
  IF length(d) = 10 AND substring(d from 3 for 1) IN ('6','7','8','9') THEN
    d := left(d, 2) || '9' || substring(d from 3);
  END IF;

  RETURN d;
END;
$$;

-- Gravar telefone_normalizado já canônico
CREATE OR REPLACE FUNCTION public.set_lead_telefone_normalizado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.telefone_normalizado := public.canonical_phone(NEW.telefone);
  RETURN NEW;
END;
$$;

-- Backfill
SET LOCAL app.bypass_permissions = 'true';

UPDATE public.leads
SET telefone_normalizado = public.canonical_phone(telefone)
WHERE telefone IS NOT NULL
  AND telefone_normalizado IS DISTINCT FROM public.canonical_phone(telefone);

SET LOCAL app.bypass_permissions = 'false';

-- Índice sem filtro de ativo
DROP INDEX IF EXISTS public.idx_leads_telefone_normalizado;
CREATE INDEX idx_leads_telefone_normalizado
  ON public.leads (unidade_id, telefone_normalizado);

-- Trava de duplicidade considerando ativos e inativos
CREATE OR REPLACE FUNCTION public.check_duplicate_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_phone text;
  existing_lead record;
BEGIN
  IF current_setting('app.bypass_permissions', true) = 'true' THEN
    RETURN NEW;
  END IF;

  normalized_phone := public.canonical_phone(NEW.telefone);

  IF normalized_phone IS NULL OR normalized_phone = '' THEN
    RETURN NEW;
  END IF;

  SELECT id, nome, telefone, ativo INTO existing_lead
  FROM public.leads
  WHERE unidade_id IS NOT DISTINCT FROM NEW.unidade_id
    AND public.canonical_phone(telefone) = normalized_phone
    AND (TG_OP = 'INSERT' OR id != NEW.id)
  ORDER BY ativo DESC
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Lead duplicado detectado: já existe um lead (%) com este telefone nesta unidade. Lead existente: % - % - %',
      CASE WHEN existing_lead.ativo THEN 'ativo' ELSE 'inativo' END,
      existing_lead.nome, existing_lead.id,
      CASE WHEN existing_lead.ativo THEN 'ativo' ELSE 'inativo' END
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;
