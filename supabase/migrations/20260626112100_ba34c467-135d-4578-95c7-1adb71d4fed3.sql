
ALTER TABLE public.nps_notificacoes_log
  ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id);

CREATE INDEX IF NOT EXISTS nps_notificacoes_log_unidade_id_idx
  ON public.nps_notificacoes_log(unidade_id);

-- Replace overly-broad SELECT policy
DROP POLICY IF EXISTS "Admins e coordenadores podem ver logs NPS" ON public.nps_notificacoes_log;

CREATE POLICY "select_nps_notificacoes_log_admin"
  ON public.nps_notificacoes_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "select_nps_notificacoes_log_coordenador_by_unidade"
  ON public.nps_notificacoes_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordenador'::public.app_role)
    AND unidade_id IS NOT NULL
    AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  );
