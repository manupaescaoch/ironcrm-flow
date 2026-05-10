CREATE TABLE public.encerramento_coordenador_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Identificação
  nome text NOT NULL,
  unidade text NOT NULL,
  turno text NOT NULL,
  ultimo_turno_dia boolean NOT NULL DEFAULT false,

  -- Estrutura e ambiente (0-5)
  limpeza_geral smallint,
  equipamentos_funcionando smallint,
  climatizacao smallint,
  organizacao_espaco smallint,
  infraestrutura smallint,

  -- Equipe
  todos_compareceram boolean,
  faltas_atrasos text,
  postura_atendimento smallint,
  proatividade smallint,
  destaque_positivo boolean,
  destaque_descricao text,
  feedback_corretivo boolean,
  feedback_descricao text,

  -- Alunos
  reclamacao_aluno boolean,
  reclamacao_descricao text,
  reclamacao_acao text,
  reclamacao_resolvida boolean,
  reclamacao_pendencia text,
  elogio_aluno boolean,
  elogio_descricao text,

  -- Ocorrências
  teve_ocorrencia boolean,
  ocorrencia_tipo text,
  ocorrencia_gravidade text,
  ocorrencia_descricao text,
  ocorrencia_acao text,
  ocorrencia_resolvida boolean,
  ocorrencia_pendencia text,

  -- Avaliação do turno
  padrao_iron boolean,
  fora_padrao_descricao text,
  funcionou_bem text,
  nota_geral smallint,

  -- Fechamento do dia (somente se ultimo_turno_dia = true)
  pontos_atencao text,
  pendencias_abertas text
);

ALTER TABLE public.encerramento_coordenador_respostas ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode inserir (formulário público em tablet)
CREATE POLICY "Anyone can insert encerramento coordenador"
ON public.encerramento_coordenador_respostas
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Apenas admins podem ver
CREATE POLICY "Admins can view encerramento coordenador"
ON public.encerramento_coordenador_respostas
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Apenas admins podem atualizar
CREATE POLICY "Admins can update encerramento coordenador"
ON public.encerramento_coordenador_respostas
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Apenas admins podem deletar
CREATE POLICY "Admins can delete encerramento coordenador"
ON public.encerramento_coordenador_respostas
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));