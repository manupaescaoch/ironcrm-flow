-- Adicionar colunas para motivo de perda
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS motivo_perda TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS data_perda TIMESTAMP WITH TIME ZONE;