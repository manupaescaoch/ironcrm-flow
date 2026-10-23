ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS data_pagamento_prevista date,
  ADD COLUMN IF NOT EXISTS reagendado_por_nome text,
  ADD COLUMN IF NOT EXISTS reagendado_em timestamptz,
  ADD COLUMN IF NOT EXISTS baixa_origem text;
COMMENT ON COLUMN public.contas_pagar.data_pagamento_prevista IS 'Data interna prevista de pagamento após reagendamento; não altera data_vencimento (vencimento do boleto).';
COMMENT ON COLUMN public.contas_pagar.baixa_origem IS 'Origem da baixa: manual | telegram_declarado (pagamento declarado, sujeito a conciliação).';
CREATE INDEX IF NOT EXISTS idx_contas_pagar_prevista ON public.contas_pagar (data_pagamento_prevista) WHERE status = 'pendente';