CREATE TABLE public.integracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'nao_configurado',
  active BOOLEAN NOT NULL DEFAULT false,
  external_id TEXT,
  external_name TEXT,
  external_username TEXT,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integracoes TO authenticated;
GRANT ALL ON public.integracoes TO service_role;

ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver integracoes" ON public.integracoes
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem gerenciar integracoes" ON public.integracoes
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_integracoes_updated_at BEFORE UPDATE ON public.integracoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.integracoes (provider) VALUES ('telegram') ON CONFLICT (provider) DO NOTHING;