CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque_unidade_created ON public.movimentacoes_estoque (unidade_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cronograma_envios_atividade_status_created ON public.cronograma_envios (atividade_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_cronograma_atividades_unidade_ativo_dia ON public.cronograma_atividades (unidade_id, ativo, dia_semana);

CREATE INDEX IF NOT EXISTS idx_follow_ups_unidade_status_concluido ON public.follow_ups (unidade_id, status, concluido_em);