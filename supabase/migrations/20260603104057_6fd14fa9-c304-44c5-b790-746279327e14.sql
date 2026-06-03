ALTER TABLE public.gestao_metas
ADD COLUMN IF NOT EXISTS alunos_ativos_semana_anterior integer NOT NULL DEFAULT 0;