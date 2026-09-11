ALTER TABLE public.insumos DROP CONSTRAINT IF EXISTS insumos_codigo_insumo_key;
DROP INDEX IF EXISTS public.insumos_codigo_insumo_key;
CREATE UNIQUE INDEX IF NOT EXISTS insumos_unidade_codigo_key ON public.insumos (unidade_id, codigo_insumo);