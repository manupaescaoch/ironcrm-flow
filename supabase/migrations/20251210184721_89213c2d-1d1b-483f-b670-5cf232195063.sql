-- Add origem_fechamento column to interacoes table
ALTER TABLE public.interacoes 
ADD COLUMN IF NOT EXISTS origem_fechamento text;

-- Add a comment to document allowed values
COMMENT ON COLUMN public.interacoes.origem_fechamento IS 'Allowed values: agendamento_comercial, espontaneo_recepcao';