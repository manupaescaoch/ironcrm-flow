-- Adicionar coluna hora_aula_experimental na tabela leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS hora_aula_experimental time without time zone;