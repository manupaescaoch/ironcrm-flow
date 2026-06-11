ALTER TABLE public.relatorio_diario_comercial_respostas
  ADD COLUMN IF NOT EXISTS evasao integer,
  ADD COLUMN IF NOT EXISTS inadimplentes_qtd integer,
  ADD COLUMN IF NOT EXISTS nao_renovados_qtd integer,
  ADD COLUMN IF NOT EXISTS ocorrencia boolean,
  ADD COLUMN IF NOT EXISTS ocorrencia_descricao text,
  ADD COLUMN IF NOT EXISTS feedback_negativo boolean,
  ADD COLUMN IF NOT EXISTS feedback_negativo_descricao text;