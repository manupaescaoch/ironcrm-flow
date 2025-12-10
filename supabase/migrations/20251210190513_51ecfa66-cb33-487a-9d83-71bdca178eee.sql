-- Add quem_agendou field for tracking commercial person who scheduled the lead
ALTER TABLE public.interacoes 
ADD COLUMN IF NOT EXISTS quem_agendou text;

COMMENT ON COLUMN public.interacoes.quem_agendou IS 'Commercial person who originally scheduled the lead (used when origem_fechamento = espontaneo_recepcao)';