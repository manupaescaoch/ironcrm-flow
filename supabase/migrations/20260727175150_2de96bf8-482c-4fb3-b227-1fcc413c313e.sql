ALTER TABLE public.follow_ups DROP CONSTRAINT IF EXISTS follow_ups_status_check;
ALTER TABLE public.follow_ups ADD CONSTRAINT follow_ups_status_check
  CHECK (status = ANY (ARRAY['pendente'::text, 'enviando'::text, 'concluido'::text, 'cancelado'::text]));