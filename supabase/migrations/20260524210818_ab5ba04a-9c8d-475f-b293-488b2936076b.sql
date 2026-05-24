
-- Agente de Atendimento (configuração)
CREATE TABLE public.agentes_atendimento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidade_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT 'SDR IRON CLUB',
  descricao TEXT,
  prompt TEXT,
  mensagem_inicial TEXT,
  mensagem_pos_solicitacao TEXT DEFAULT 'Perfeito. Sua solicitação de experimental foi registrada 💙

Vamos considerar o dia e horário que você informou. Caso precise ajustar alguma informação, é só me avisar.',
  status TEXT NOT NULL DEFAULT 'inativo',
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  regras JSONB NOT NULL DEFAULT '{}'::jsonb,
  configuracao_experimental JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por UUID,
  atualizado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(unidade_id)
);

ALTER TABLE public.agentes_atendimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_agentes_admin_comercial"
ON public.agentes_atendimento FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid())))
);

CREATE POLICY "insert_agentes_admin_comercial"
ON public.agentes_atendimento FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid())))
);

CREATE POLICY "update_agentes_admin_comercial"
ON public.agentes_atendimento FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid())))
);

CREATE POLICY "delete_agentes_admin"
ON public.agentes_atendimento FOR DELETE
USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER agentes_atendimento_updated_at
BEFORE UPDATE ON public.agentes_atendimento
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atendimentos do agente
CREATE TABLE public.agente_atendimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id UUID NOT NULL REFERENCES public.agentes_atendimento(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL,
  lead_id UUID,
  aluno_id UUID,
  nome TEXT,
  telefone TEXT,
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'novo',
  objetivo TEXT,
  horario_treino TEXT,
  unidade_interesse TEXT,
  plano_indicado TEXT,
  resumo_conversa TEXT,
  experimental_solicitada BOOLEAN NOT NULL DEFAULT false,
  dia_experimental DATE,
  horario_experimental TIME,
  primeira_interacao_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ultima_interacao_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agente_atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_atendimentos_admin_comercial"
ON public.agente_atendimentos FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid())))
);

CREATE POLICY "insert_atendimentos_admin_comercial"
ON public.agente_atendimentos FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid())))
);

CREATE POLICY "update_atendimentos_admin_comercial"
ON public.agente_atendimentos FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid())))
);

CREATE POLICY "delete_atendimentos_admin"
ON public.agente_atendimentos FOR DELETE
USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER agente_atendimentos_updated_at
BEFORE UPDATE ON public.agente_atendimentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_agente_atendimentos_agente ON public.agente_atendimentos(agente_id);
CREATE INDEX idx_agente_atendimentos_unidade ON public.agente_atendimentos(unidade_id);
CREATE INDEX idx_agente_atendimentos_status ON public.agente_atendimentos(status);
CREATE INDEX idx_agente_atendimentos_ultima ON public.agente_atendimentos(ultima_interacao_at DESC);

-- Histórico de versões
CREATE TABLE public.agentes_atendimento_versoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id UUID NOT NULL REFERENCES public.agentes_atendimento(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL,
  prompt TEXT,
  mensagem_inicial TEXT,
  mensagem_pos_solicitacao TEXT,
  nome TEXT,
  descricao TEXT,
  regras JSONB NOT NULL DEFAULT '{}'::jsonb,
  configuracao_experimental JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agentes_atendimento_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_versoes_admin_comercial"
ON public.agentes_atendimento_versoes FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid())))
);

CREATE POLICY "insert_versoes_admin_comercial"
ON public.agentes_atendimento_versoes FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid())))
);

CREATE POLICY "delete_versoes_admin"
ON public.agentes_atendimento_versoes FOR DELETE
USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_versoes_agente ON public.agentes_atendimento_versoes(agente_id, created_at DESC);
