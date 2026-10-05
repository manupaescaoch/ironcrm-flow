ALTER TABLE public.gestao_metas
ADD COLUMN supermeta_alunos_mes integer NOT NULL DEFAULT 0;

ALTER TABLE public.gestao_metas
ADD CONSTRAINT gestao_metas_supermeta_valida
CHECK (supermeta_alunos_mes = 0 OR supermeta_alunos_mes >= meta_alunos_mes);

COMMENT ON COLUMN public.gestao_metas.meta_alunos_mes IS 'Meta mínima mensal de alunos; nome legado mantido para compatibilidade.';
COMMENT ON COLUMN public.gestao_metas.supermeta_alunos_mes IS 'Supermeta mensal de alunos; zero indica que não foi definida.';