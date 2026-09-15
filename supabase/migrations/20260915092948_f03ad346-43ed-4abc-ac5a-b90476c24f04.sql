INSERT INTO public.telegram_groups (group_type, name, unidade_id, status)
SELECT t.group_type, t.name, u.id, 'pendente'
FROM (VALUES ('nps', 'NPS'), ('anamnese', 'Anamnese')) AS t(group_type, name)
CROSS JOIN public.unidades u
WHERE NOT EXISTS (
  SELECT 1 FROM public.telegram_groups g
  WHERE g.group_type = t.group_type AND g.unidade_id IS NOT DISTINCT FROM u.id
);