-- Add tipo_atendimento column to interacoes table
ALTER TABLE public.interacoes 
ADD COLUMN IF NOT EXISTS tipo_atendimento text DEFAULT NULL;

-- Add a comment to explain the column
COMMENT ON COLUMN public.interacoes.tipo_atendimento IS 'Type of service: comercial or espontaneo_recepcao';