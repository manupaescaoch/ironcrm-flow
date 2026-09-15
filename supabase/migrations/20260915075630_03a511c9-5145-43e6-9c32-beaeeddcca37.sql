ALTER TABLE public.telegram_groups ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS public.telegram_groups_one_active_per_type;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_groups_one_active_per_type_unit
ON public.telegram_groups (group_type, unidade_id)
WHERE status = 'ativo';