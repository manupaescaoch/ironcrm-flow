-- Add confirmado column to interacoes table for experimental class confirmations
ALTER TABLE public.interacoes ADD COLUMN IF NOT EXISTS confirmado boolean DEFAULT NULL;