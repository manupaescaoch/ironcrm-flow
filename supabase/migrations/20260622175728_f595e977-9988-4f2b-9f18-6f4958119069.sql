
ALTER TABLE public.cronograma_funcionarios
  ADD COLUMN IF NOT EXISTS cargo text;

ALTER TABLE public.cronograma_funcionarios
  DROP CONSTRAINT IF EXISTS cronograma_funcionarios_cargo_check;

ALTER TABLE public.cronograma_funcionarios
  ADD CONSTRAINT cronograma_funcionarios_cargo_check
  CHECK (cargo IS NULL OR cargo IN ('recepcao','coordenador_unidade','treinador','estagiario_lider'));
