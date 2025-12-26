-- Add financial tracking columns to movimentacoes_estoque
ALTER TABLE public.movimentacoes_estoque
ADD COLUMN IF NOT EXISTS valor_unitario numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS valor_total numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fornecedor text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS nota_fiscal text DEFAULT NULL;