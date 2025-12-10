-- Add atendido_por_tipo column to interacoes table
ALTER TABLE public.interacoes 
ADD COLUMN atendido_por_tipo text DEFAULT 'espontaneo_recepcao';

-- Add a comment to explain the field
COMMENT ON COLUMN public.interacoes.atendido_por_tipo IS 'Type of service: comercial (scheduled) or espontaneo_recepcao (walk-in)';