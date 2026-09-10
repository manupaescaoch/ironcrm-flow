CREATE INDEX IF NOT EXISTS idx_leads_unidade_ativo_created ON public.leads (unidade_id, ativo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interacoes_unidade_data_exp ON public.interacoes (unidade_id, data_experimental);
CREATE INDEX IF NOT EXISTS idx_interacoes_unidade_fechamento ON public.interacoes (unidade_id, fechou_matricula, data_fechamento DESC);
CREATE INDEX IF NOT EXISTS idx_interacoes_unidade_compareceu ON public.interacoes (unidade_id, compareceu, fechou_matricula);
ANALYZE public.leads;
ANALYZE public.interacoes;