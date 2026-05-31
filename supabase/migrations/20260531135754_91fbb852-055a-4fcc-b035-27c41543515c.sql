ALTER TABLE public.reunioes
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS feedback text;