-- Remover constraint antiga
ALTER TABLE public.movimentacoes_estoque DROP CONSTRAINT IF EXISTS movimentacoes_estoque_setor_check;

-- Criar nova constraint com "Recepção" incluído
ALTER TABLE public.movimentacoes_estoque ADD CONSTRAINT movimentacoes_estoque_setor_check 
CHECK (setor = ANY (ARRAY['Limpeza'::text, 'Café'::text, 'Treino'::text, 'Administrativo'::text, 'Recepção'::text]));