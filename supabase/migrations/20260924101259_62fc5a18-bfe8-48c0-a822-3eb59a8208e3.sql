CREATE TABLE public.cancelamento_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL,
  ddi text NOT NULL DEFAULT '+55',
  unidade text NOT NULL,
  unidade_id uuid,
  plano text,
  motivos text[] NOT NULL DEFAULT '{}',
  detalhamento text,
  problemas text[] NOT NULL DEFAULT '{}',
  acompanhamento text,
  evolucao text,
  nota int CHECK (nota BETWEEN 0 AND 10),
  pontos_positivos text,
  evitaria_saida text,
  solucoes_retencao text[] NOT NULL DEFAULT '{}',
  vai_treinar_outro_local text,
  proxima_escolha text,
  fator_escolha text,
  aceita_contato_antes boolean,
  aceita_contato_futuro boolean,
  status text NOT NULL DEFAULT 'Nova solicitação',
  telegram_enviado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.cancelamento_solicitacoes TO authenticated;
GRANT ALL ON public.cancelamento_solicitacoes TO service_role;
ALTER TABLE public.cancelamento_solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem cancelamentos" ON public.cancelamento_solicitacoes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins atualizam cancelamentos" ON public.cancelamento_solicitacoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_cancelamento_solicitacoes_updated_at BEFORE UPDATE ON public.cancelamento_solicitacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();