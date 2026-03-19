-- Remove the duplicate trigger (keep only one)
DROP TRIGGER IF EXISTS trg_atualizar_estoque ON public.movimentacoes_estoque;