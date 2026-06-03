ALTER TABLE public.gestao_metas
ADD COLUMN IF NOT EXISTS evasao_pct_manual numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cac_manual numeric NOT NULL DEFAULT 0;