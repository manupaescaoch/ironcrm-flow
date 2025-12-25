-- Adicionar campos para sistema preditivo de estoque
ALTER TABLE public.insumos 
ADD COLUMN IF NOT EXISTS lead_time_dias integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS estoque_seguranca_dias integer NOT NULL DEFAULT 2;

-- Comentários para documentação
COMMENT ON COLUMN public.insumos.lead_time_dias IS 'Tempo em dias que o fornecedor leva para entregar o pedido';
COMMENT ON COLUMN public.insumos.estoque_seguranca_dias IS 'Dias de estoque de segurança para cobrir variações de demanda';