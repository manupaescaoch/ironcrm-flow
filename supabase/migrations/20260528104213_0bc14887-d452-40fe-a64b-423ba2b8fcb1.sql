CREATE TABLE public.whatsapp_envios_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  funcao text NOT NULL,
  destino text,
  tipo_destino text,
  unidade_id uuid,
  sucesso boolean NOT NULL DEFAULT false,
  erro_msg text,
  zapi_status_code int,
  motivo_skip text
);

CREATE INDEX idx_wel_created_at ON public.whatsapp_envios_log (created_at DESC);
CREATE INDEX idx_wel_funcao ON public.whatsapp_envios_log (funcao);
CREATE INDEX idx_wel_unidade ON public.whatsapp_envios_log (unidade_id);

GRANT SELECT ON public.whatsapp_envios_log TO authenticated;
GRANT ALL ON public.whatsapp_envios_log TO service_role;

ALTER TABLE public.whatsapp_envios_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins visualizam logs whatsapp"
ON public.whatsapp_envios_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
