CREATE TABLE public.cancelamento_observacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.cancelamento_solicitacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  usuario_nome text,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cancelamento_observacoes TO authenticated;
GRANT ALL ON public.cancelamento_observacoes TO service_role;
ALTER TABLE public.cancelamento_observacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestao ve observacoes" ON public.cancelamento_observacoes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cancelamento_solicitacoes s WHERE s.id = solicitacao_id AND (has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'coordenador')) AND user_has_unidade_access(auth.uid(), s.unidade_id)))));
CREATE POLICY "Gestao cria observacoes" ON public.cancelamento_observacoes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.cancelamento_solicitacoes s WHERE s.id = solicitacao_id AND (has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'coordenador')) AND user_has_unidade_access(auth.uid(), s.unidade_id)))));
CREATE INDEX ON public.cancelamento_observacoes(solicitacao_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.cancelamento_solicitacoes;