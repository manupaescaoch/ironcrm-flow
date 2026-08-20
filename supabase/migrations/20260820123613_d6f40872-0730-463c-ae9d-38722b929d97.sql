-- 1) Corrigir unidade dos dois leads cadastrados por engano em EVO MADALENA
UPDATE public.leads
SET unidade_id = 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a'
WHERE id IN ('54b6d476-15d1-491f-828d-7dccf731ff8e','60a04d17-1ebd-4379-b6c8-ac65217f4b6c');

UPDATE public.interacoes SET unidade_id = 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a'
WHERE lead_id IN ('54b6d476-15d1-491f-828d-7dccf731ff8e','60a04d17-1ebd-4379-b6c8-ac65217f4b6c');

UPDATE public.follow_ups SET unidade_id = 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a'
WHERE lead_id IN ('54b6d476-15d1-491f-828d-7dccf731ff8e','60a04d17-1ebd-4379-b6c8-ac65217f4b6c');

-- 2) Remover leads duplicados (mesmo telefone + mesma unidade), mantendo o mais antigo
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY unidade_id, telefone_normalizado
    ORDER BY created_at ASC, id ASC
  ) AS rn
  FROM public.leads
  WHERE telefone_normalizado IS NOT NULL AND telefone_normalizado <> ''
),
dups AS (SELECT id FROM ranked WHERE rn > 1)
UPDATE public.leads SET ativo = false
WHERE id IN (SELECT id FROM dups) AND ativo = true;