-- Add treinador_experimental column to interacoes table
ALTER TABLE public.interacoes ADD COLUMN IF NOT EXISTS treinador_experimental text;