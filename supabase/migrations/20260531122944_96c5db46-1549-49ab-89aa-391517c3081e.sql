ALTER TABLE public.whatsapp_envios_log ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'operacional';
ALTER TABLE public.formulario_grupos_whatsapp ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'operacional';
ALTER TABLE public.rotina_webhook_auditoria ADD COLUMN IF NOT EXISTS canal_origem text;