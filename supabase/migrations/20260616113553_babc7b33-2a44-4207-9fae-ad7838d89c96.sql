
ALTER TABLE public.relatorio_diario_comercial_respostas
  ADD COLUMN IF NOT EXISTS experimentais_agendadas integer,
  ADD COLUMN IF NOT EXISTS fechamento_experimentais text,
  ADD COLUMN IF NOT EXISTS qtd_nao_fecharam integer,
  ADD COLUMN IF NOT EXISTS motivo_nao_fechamento text,
  ADD COLUMN IF NOT EXISTS motivo_nao_fechamento_outro text,
  ADD COLUMN IF NOT EXISTS novas_matriculas_texto text,
  ADD COLUMN IF NOT EXISTS renovacoes_texto text,
  ADD COLUMN IF NOT EXISTS cancelamentos_texto text,
  ADD COLUMN IF NOT EXISTS nao_renovados_texto text,
  ADD COLUMN IF NOT EXISTS inadimplentes_texto text,
  ADD COLUMN IF NOT EXISTS feedback_acao_tomada boolean,
  ADD COLUMN IF NOT EXISTS feedback_acao_descricao text;
