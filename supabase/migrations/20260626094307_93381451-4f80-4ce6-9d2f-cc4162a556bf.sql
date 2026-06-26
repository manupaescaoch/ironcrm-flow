
CREATE TABLE public.nps_respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  unidade_nome TEXT NOT NULL,
  nota_nps SMALLINT NOT NULL CHECK (nota_nps BETWEEN 0 AND 10),
  estrelas_estrutura SMALLINT NOT NULL CHECK (estrelas_estrutura BETWEEN 1 AND 5),
  estrelas_equipe SMALLINT NOT NULL CHECK (estrelas_equipe BETWEEN 1 AND 5),
  estrelas_treino SMALLINT NOT NULL CHECK (estrelas_treino BETWEEN 1 AND 5),
  pontos_positivos TEXT[] NOT NULL DEFAULT '{}',
  pontos_melhoria TEXT[] NOT NULL DEFAULT '{}',
  tempo_aluno TEXT NOT NULL,
  comentario TEXT,
  categoria TEXT GENERATED ALWAYS AS (
    CASE
      WHEN nota_nps <= 6 THEN 'detrator'
      WHEN nota_nps <= 8 THEN 'passivo'
      ELSE 'promotor'
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.nps_respostas TO authenticated;
GRANT INSERT ON public.nps_respostas TO anon;
GRANT ALL ON public.nps_respostas TO service_role;

ALTER TABLE public.nps_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode enviar avaliação NPS"
  ON public.nps_respostas FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin e coordenador podem ver respostas NPS"
  ON public.nps_respostas FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'coordenador'::public.app_role)
  );

CREATE INDEX nps_respostas_created_at_idx ON public.nps_respostas (created_at DESC);
CREATE INDEX nps_respostas_unidade_idx ON public.nps_respostas (unidade_nome);
