
WITH ranked AS (
  SELECT id, ativo,
    ROW_NUMBER() OVER (
      PARTITION BY tipo_atividade, unidade_id, responsavel_id, dia_semana, horario, turno
      ORDER BY ativo DESC, created_at ASC, id ASC
    ) AS rn
  FROM public.cronograma_atividades
),
dups AS (
  SELECT id FROM ranked WHERE rn > 1
),
deletable AS (
  SELECT d.id FROM dups d
  WHERE NOT EXISTS (SELECT 1 FROM public.cronograma_envios e WHERE e.atividade_id = d.id)
)
DELETE FROM public.cronograma_atividades
WHERE id IN (SELECT id FROM deletable);
