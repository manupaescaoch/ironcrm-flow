CREATE TABLE public.relatorio_diario_comercial_respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL,
  data DATE NOT NULL,
  total_alunos_ativos INTEGER,
  leads_recebidos INTEGER,
  experimentais_realizadas INTEGER,
  novos_alunos INTEGER,
  renovacoes INTEGER,
  cancelamentos INTEGER,
  inadimplentes TEXT,
  nao_renovados TEXT,
  atividades_realizadas TEXT[],
  pendencias TEXT,
  plano_amanha TEXT,
  precisa_suporte BOOLEAN,
  suporte_descricao TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.relatorio_diario_comercial_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit relatorio diario"
ON public.relatorio_diario_comercial_respostas
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view relatorio diario"
ON public.relatorio_diario_comercial_respostas
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update relatorio diario"
ON public.relatorio_diario_comercial_respostas
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete relatorio diario"
ON public.relatorio_diario_comercial_respostas
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_relatorio_diario_comercial_updated_at
BEFORE UPDATE ON public.relatorio_diario_comercial_respostas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();