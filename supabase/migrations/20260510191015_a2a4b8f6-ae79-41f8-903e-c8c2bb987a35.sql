CREATE TABLE public.encerramento_turno_respostas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  unidade text NOT NULL,
  turno text NOT NULL,
  experimentais_realizadas integer NOT NULL DEFAULT 0,
  teve_ocorrencia boolean NOT NULL DEFAULT false,
  ocorrencia_descricao text,
  manteve_padrao boolean NOT NULL DEFAULT true,
  padrao_observacao text,
  recebeu_feedback boolean NOT NULL DEFAULT false,
  feedback_descricao text,
  clima_equipe integer NOT NULL DEFAULT 0,
  clima_influencia text,
  equipamento_problema boolean NOT NULL DEFAULT false,
  equipamento_descricao text,
  faria_diferente text,
  precisou_suporte boolean NOT NULL DEFAULT false,
  suporte_descricao text,
  observacao_gestao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.encerramento_turno_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_encerramento_turno"
ON public.encerramento_turno_respostas FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "admin_select_encerramento_turno"
ON public.encerramento_turno_respostas FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_update_encerramento_turno"
ON public.encerramento_turno_respostas FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_delete_encerramento_turno"
ON public.encerramento_turno_respostas FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));