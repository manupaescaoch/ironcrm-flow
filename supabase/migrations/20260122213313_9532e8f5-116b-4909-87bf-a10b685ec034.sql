-- Tabela para registrar confirmações de pagamento mensal
CREATE TABLE public.pagamentos_mensais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interacao_id UUID NOT NULL REFERENCES public.interacoes(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL,
  unidade_id UUID NOT NULL,
  data_vencimento DATE NOT NULL,
  data_confirmacao DATE NOT NULL DEFAULT CURRENT_DATE,
  confirmado_por TEXT,
  valor NUMERIC,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pagamentos_mensais ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "select_pagamentos_by_unidade" 
ON public.pagamentos_mensais 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY "insert_pagamentos_by_unidade" 
ON public.pagamentos_mensais 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY "update_pagamentos_by_unidade" 
ON public.pagamentos_mensais 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY "delete_pagamentos_by_unidade" 
ON public.pagamentos_mensais 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

-- Index for faster queries
CREATE INDEX idx_pagamentos_lead_id ON public.pagamentos_mensais(lead_id);
CREATE INDEX idx_pagamentos_unidade_id ON public.pagamentos_mensais(unidade_id);
CREATE INDEX idx_pagamentos_data_vencimento ON public.pagamentos_mensais(data_vencimento);