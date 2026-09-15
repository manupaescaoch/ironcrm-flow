CREATE TABLE public.telegram_convites_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  link TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  enviar_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_convites_status ON public.telegram_convites_whatsapp (status, enviar_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_convites_whatsapp TO authenticated;
GRANT ALL ON public.telegram_convites_whatsapp TO service_role;

ALTER TABLE public.telegram_convites_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam convites telegram"
ON public.telegram_convites_whatsapp FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_telegram_convites_whatsapp_updated_at
BEFORE UPDATE ON public.telegram_convites_whatsapp
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();