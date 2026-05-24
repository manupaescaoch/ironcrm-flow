
CREATE TABLE IF NOT EXISTS public.agente_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id uuid NOT NULL REFERENCES public.agente_atendimentos(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  conteudo text NOT NULL,
  external_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agente_mensagens_atendimento ON public.agente_mensagens(atendimento_id, created_at);

ALTER TABLE public.agente_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_mensagens_admin_comercial" ON public.agente_mensagens
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(),'admin'::app_role)
    OR (public.has_role(auth.uid(),'user'::app_role) AND unidade_id IN (SELECT public.get_user_unidades(auth.uid())))
  )
);

CREATE POLICY "insert_mensagens_admin_comercial" ON public.agente_mensagens
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(),'admin'::app_role)
    OR (public.has_role(auth.uid(),'user'::app_role) AND unidade_id IN (SELECT public.get_user_unidades(auth.uid())))
  )
);
