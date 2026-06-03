SET LOCAL app.bypass_permissions = 'true';

UPDATE public.unidades SET nome = 'Iron Madalena', slug = 'iron-madalena'
  WHERE id = 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6';
UPDATE public.unidades SET nome = 'Iron Boa Viagem', slug = 'iron-boa-viagem'
  WHERE id = 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a';

INSERT INTO public.unidades (id, nome, slug, ativo)
VALUES ('00000000-0000-0000-0000-000000000000', 'Iron — Não definida', 'nao-definida', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS telefone_normalizado text,
  ADD COLUMN IF NOT EXISTS fonte text DEFAULT 'WHATSAPP',
  ADD COLUMN IF NOT EXISTS status_conversa text DEFAULT 'aguardando_resposta',
  ADD COLUMN IF NOT EXISTS ultima_interacao_at timestamptz,
  ADD COLUMN IF NOT EXISTS valor_pipeline numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS convertido_em_aluno_at timestamptz,
  ADD COLUMN IF NOT EXISTS atendimento_id uuid;

CREATE OR REPLACE FUNCTION public.set_lead_telefone_normalizado()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.telefone IS NULL THEN
    NEW.telefone_normalizado := NULL;
  ELSE
    NEW.telefone_normalizado := NULLIF(regexp_replace(NEW.telefone, '\D', '', 'g'), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_telefone_normalizado ON public.leads;
CREATE TRIGGER trg_lead_telefone_normalizado
  BEFORE INSERT OR UPDATE OF telefone ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_lead_telefone_normalizado();

UPDATE public.leads
  SET telefone_normalizado = NULLIF(regexp_replace(telefone, '\D', '', 'g'), '')
  WHERE telefone IS NOT NULL AND telefone_normalizado IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_telefone_normalizado
  ON public.leads (telefone_normalizado) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_leads_status_conversa
  ON public.leads (status_conversa) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_leads_ultima_interacao
  ON public.leads (ultima_interacao_at DESC) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_leads_fonte ON public.leads (fonte) WHERE ativo = true;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_atendimento_id_fkey'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_atendimento_id_fkey FOREIGN KEY (atendimento_id)
      REFERENCES public.agente_atendimentos(id) ON DELETE SET NULL;
  END IF;
END $$;