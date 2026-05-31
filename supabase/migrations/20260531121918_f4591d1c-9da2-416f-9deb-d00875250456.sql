
CREATE TABLE public.rotina_webhook_auditoria (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id text,
  instance_id text,
  telefone_mascarado text,
  rotina_id uuid,
  status_aplicado text,
  autorizado boolean NOT NULL,
  motivo_bloqueio text,
  auth_method text,
  payload_resumo jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rotina_webhook_auditoria_msgid_uniq
  ON public.rotina_webhook_auditoria (message_id)
  WHERE message_id IS NOT NULL AND autorizado = true;

CREATE INDEX rotina_webhook_auditoria_rotina_idx
  ON public.rotina_webhook_auditoria (rotina_id, created_at DESC);

CREATE INDEX rotina_webhook_auditoria_telefone_idx
  ON public.rotina_webhook_auditoria (telefone_mascarado, created_at DESC);

GRANT SELECT ON public.rotina_webhook_auditoria TO authenticated;
GRANT ALL ON public.rotina_webhook_auditoria TO service_role;

ALTER TABLE public.rotina_webhook_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_rotina_webhook_auditoria"
ON public.rotina_webhook_auditoria
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
