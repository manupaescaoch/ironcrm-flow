CREATE TABLE public.encerramento_tecnico_respostas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidade text NOT NULL,
  unidade_id uuid,
  coordenador_nome text NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,

  alinhamento_manha boolean NOT NULL,
  alinhamento_manha_motivo text,
  alinhamento_noite boolean NOT NULL,
  alinhamento_noite_motivo text,
  pontos_alinhados text[] NOT NULL DEFAULT '{}',
  pontos_alinhados_detalhe text,

  ronda_tecnica text NOT NULL,
  ronda_motivo text,
  teve_desvio boolean NOT NULL DEFAULT false,
  desvios jsonb NOT NULL DEFAULT '[]'::jsonb,
  teve_feedback boolean NOT NULL DEFAULT false,
  feedbacks jsonb NOT NULL DEFAULT '[]'::jsonb,
  teve_destaque boolean NOT NULL DEFAULT false,
  destaques jsonb NOT NULL DEFAULT '[]'::jsonb,

  escala_cumprida boolean NOT NULL,
  escala_ocorrencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  distribuicao_alunos text NOT NULL,
  distribuicao_problema text,
  distribuicao_ajuste text,
  alunos_atendidos_tarde integer NOT NULL DEFAULT 0,
  atendimentos_treinador jsonb NOT NULL DEFAULT '[]'::jsonb,
  experimentais_agendadas integer NOT NULL DEFAULT 0,
  experimentais_realizadas integer NOT NULL DEFAULT 0,
  experimentais_ausentes integer NOT NULL DEFAULT 0,

  teve_ocorrencia_aluno boolean NOT NULL DEFAULT false,
  ocorrencias_aluno jsonb NOT NULL DEFAULT '[]'::jsonb,

  sala_organizada text NOT NULL,
  sala_problema text,
  sala_providencia text,
  teve_problema_estrutura boolean NOT NULL DEFAULT false,
  estrutura_problema text,
  estrutura_impacto text,
  estrutura_providencia text,
  estrutura_gerente_comunicado boolean,

  teve_pendencia boolean NOT NULL DEFAULT false,
  pendencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  prioridade_tecnica text NOT NULL,
  prioridade_detalhe text,

  substitui_resposta_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_enc_tecnico_unidade_data ON public.encerramento_tecnico_respostas (unidade_id, data DESC);
CREATE INDEX idx_enc_tecnico_created_at ON public.encerramento_tecnico_respostas (created_at DESC);

GRANT INSERT ON public.encerramento_tecnico_respostas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encerramento_tecnico_respostas TO authenticated;
GRANT ALL ON public.encerramento_tecnico_respostas TO service_role;

ALTER TABLE public.encerramento_tecnico_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_encerramento_tecnico_public"
ON public.encerramento_tecnico_respostas
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Gestao can view encerramento tecnico"
ON public.encerramento_tecnico_respostas
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'coordenador'))
    AND unidade_id IS NOT NULL
    AND public.user_has_unidade_access(auth.uid(), unidade_id)
  )
);

CREATE POLICY "Admins can update encerramento tecnico"
ON public.encerramento_tecnico_respostas
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete encerramento tecnico"
ON public.encerramento_tecnico_respostas
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_enc_tecnico_updated_at
BEFORE UPDATE ON public.encerramento_tecnico_respostas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.encerramento_tecnico_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resposta_id uuid NOT NULL REFERENCES public.encerramento_tecnico_respostas(id) ON DELETE CASCADE,
  unidade_id uuid,
  snapshot jsonb NOT NULL,
  motivo text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_enc_tecnico_hist_resposta ON public.encerramento_tecnico_historico (resposta_id, created_at DESC);

GRANT INSERT ON public.encerramento_tecnico_historico TO anon;
GRANT SELECT, INSERT ON public.encerramento_tecnico_historico TO authenticated;
GRANT ALL ON public.encerramento_tecnico_historico TO service_role;

ALTER TABLE public.encerramento_tecnico_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_encerramento_tecnico_hist_public"
ON public.encerramento_tecnico_historico
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Gestao can view encerramento tecnico historico"
ON public.encerramento_tecnico_historico
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'coordenador'))
    AND unidade_id IS NOT NULL
    AND public.user_has_unidade_access(auth.uid(), unidade_id)
  )
);