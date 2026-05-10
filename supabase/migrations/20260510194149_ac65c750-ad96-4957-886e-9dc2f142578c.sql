CREATE TABLE public.formulario_grupos_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  formulario_key TEXT NOT NULL,
  unidade TEXT NOT NULL,
  grupo_id TEXT,
  grupo_nome TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (formulario_key, unidade)
);

ALTER TABLE public.formulario_grupos_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage grupos whatsapp"
ON public.formulario_grupos_whatsapp
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_formulario_grupos_whatsapp_updated_at
BEFORE UPDATE ON public.formulario_grupos_whatsapp
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.formulario_grupos_whatsapp (formulario_key, unidade) VALUES
  ('estagiario_lider', 'ZONA NORTE'),
  ('estagiario_lider', 'ZONA SUL'),
  ('coordenador_unidade', 'ZONA NORTE'),
  ('coordenador_unidade', 'ZONA SUL'),
  ('coordenador_horario', 'ZONA NORTE'),
  ('coordenador_horario', 'ZONA SUL'),
  ('relatorio_comercial', 'ZONA NORTE'),
  ('relatorio_comercial', 'ZONA SUL');