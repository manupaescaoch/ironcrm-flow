CREATE TABLE public.nps_notificacoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id uuid NOT NULL REFERENCES public.nps_respostas(id) ON DELETE CASCADE,
  unidade_nome text NOT NULL,
  nota_nps smallint NOT NULL,
  classificacao text NOT NULL CHECK (classificacao IN ('detrator','passivo','promotor')),
  responsavel_nome text,
  responsavel_telefone text,
  interna_status text,
  interna_message_id text,
  interna_erro text,
  aluno_telefone text,
  aluno_status text,
  aluno_message_id text,
  aluno_erro text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nps_notif_log_resposta ON public.nps_notificacoes_log(resposta_id);
CREATE INDEX idx_nps_notif_log_created ON public.nps_notificacoes_log(created_at DESC);

GRANT SELECT ON public.nps_notificacoes_log TO authenticated;
GRANT ALL ON public.nps_notificacoes_log TO service_role;

ALTER TABLE public.nps_notificacoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e coordenadores podem ver logs NPS"
  ON public.nps_notificacoes_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'coordenador'::public.app_role)
  );

CREATE POLICY "Service role gerencia logs NPS"
  ON public.nps_notificacoes_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);