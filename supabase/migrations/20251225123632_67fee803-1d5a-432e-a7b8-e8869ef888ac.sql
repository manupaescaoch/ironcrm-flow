-- Adicionar campos financeiros à tabela insumos
ALTER TABLE public.insumos 
ADD COLUMN IF NOT EXISTS custo_unitario numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS fornecedor_padrao text,
ADD COLUMN IF NOT EXISTS quantidade_minima_compra integer NOT NULL DEFAULT 1;

-- Comentários para documentação
COMMENT ON COLUMN public.insumos.custo_unitario IS 'Custo unitário do item em R$';
COMMENT ON COLUMN public.insumos.fornecedor_padrao IS 'Nome do fornecedor padrão para este item';
COMMENT ON COLUMN public.insumos.quantidade_minima_compra IS 'Quantidade mínima de compra (lote/caixa)';