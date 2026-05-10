CREATE TABLE public.encerramento_horario_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  nome text NOT NULL,
  data date NOT NULL,
  unidade text NOT NULL,
  turno text NOT NULL,

  teve_ocorrencia boolean,
  ocorrencia_descricao text,
  treinador_faltou boolean,
  treinador_faltou_quem text,
  atendimentos_por_treinador text,
  experimentais_realizadas integer,

  teve_feedback_aluno boolean,
  feedback_aluno_descricao text,
  destaque_positivo boolean,
  destaque_descricao text,
  feedback_corretivo boolean,
  feedback_corretivo_descricao text,

  sala_organizada boolean,
  pendencia_organizacao text,
  nota_geral smallint,
  observacoes text
);

ALTER TABLE public.encerramento_horario_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert encerramento horario"
ON public.encerramento_horario_respostas FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins can view encerramento horario"
ON public.encerramento_horario_respostas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update encerramento horario"
ON public.encerramento_horario_respostas FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete encerramento horario"
ON public.encerramento_horario_respostas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));