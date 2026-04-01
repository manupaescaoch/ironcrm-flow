
CREATE TABLE public.rotina_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id uuid REFERENCES public.rotinas(id) ON DELETE CASCADE NOT NULL,
  data_envio date NOT NULL,
  enviado_em timestamptz DEFAULT now(),
  status text DEFAULT 'enviado'
);

CREATE UNIQUE INDEX idx_rotina_notificacoes_unique ON public.rotina_notificacoes (rotina_id, data_envio);

ALTER TABLE public.rotina_notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_rotina_notificacoes_authenticated" ON public.rotina_notificacoes
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "insert_rotina_notificacoes_authenticated" ON public.rotina_notificacoes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
