
-- Tabela de configuração de canais WhatsApp internos por unidade
CREATE TABLE public.unidade_whatsapp_config (
  unidade_id uuid PRIMARY KEY,
  grupo_fu_id text,
  grupo_fu_nome text,
  telefone_recepcao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.unidade_whatsapp_config TO authenticated;
GRANT ALL ON public.unidade_whatsapp_config TO service_role;

ALTER TABLE public.unidade_whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Admin gerencia tudo
CREATE POLICY "admin_all_unidade_whatsapp_config"
ON public.unidade_whatsapp_config
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Coordenador/user da unidade pode ler config da sua unidade
CREATE POLICY "select_unidade_whatsapp_config_by_unidade"
ON public.unidade_whatsapp_config
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
);

CREATE TRIGGER trg_unidade_whatsapp_config_updated_at
BEFORE UPDATE ON public.unidade_whatsapp_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
