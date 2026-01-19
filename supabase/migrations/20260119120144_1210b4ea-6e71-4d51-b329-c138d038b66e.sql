-- Adicionar coluna data_vencimento para armazenar a data real de vencimento do contrato
ALTER TABLE public.interacoes 
ADD COLUMN IF NOT EXISTS data_vencimento date;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.interacoes.data_vencimento IS 'Data de vencimento real do contrato/plano';