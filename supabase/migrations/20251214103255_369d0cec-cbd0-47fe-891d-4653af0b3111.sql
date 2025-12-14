-- Adicionar campo quem_indicou à tabela interacoes
ALTER TABLE public.interacoes 
ADD COLUMN quem_indicou text DEFAULT NULL;