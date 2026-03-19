
-- Create formularios table
CREATE TABLE public.formularios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create formulario_campos table
CREATE TABLE public.formulario_campos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  formulario_id UUID NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'texto',
  label TEXT NOT NULL,
  opcoes JSONB,
  ordem INTEGER NOT NULL DEFAULT 0,
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create formulario_respostas table
CREATE TABLE public.formulario_respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  formulario_id UUID NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id),
  respondido_por_nome TEXT NOT NULL,
  respondido_por_telefone TEXT,
  respostas JSONB NOT NULL DEFAULT '{}',
  enviado_grupo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.formularios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulario_campos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulario_respostas ENABLE ROW LEVEL SECURITY;

-- formularios: admin only CRUD
CREATE POLICY "select_formularios_admin" ON public.formularios
  FOR SELECT USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "insert_formularios_admin" ON public.formularios
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "update_formularios_admin" ON public.formularios
  FOR UPDATE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "delete_formularios_admin" ON public.formularios
  FOR DELETE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

-- formulario_campos: admin only CRUD
CREATE POLICY "select_formulario_campos_admin" ON public.formulario_campos
  FOR SELECT USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

-- Also allow anon select for public form page
CREATE POLICY "select_formulario_campos_anon" ON public.formulario_campos
  FOR SELECT TO anon USING (true);

CREATE POLICY "insert_formulario_campos_admin" ON public.formulario_campos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "update_formulario_campos_admin" ON public.formulario_campos
  FOR UPDATE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "delete_formulario_campos_admin" ON public.formulario_campos
  FOR DELETE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

-- formulario_respostas: admin can read, anon can insert (public form)
CREATE POLICY "select_respostas_admin" ON public.formulario_respostas
  FOR SELECT USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "insert_respostas_anon" ON public.formulario_respostas
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "insert_respostas_authenticated" ON public.formulario_respostas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "delete_respostas_admin" ON public.formulario_respostas
  FOR DELETE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

-- Allow anon to select formularios for public form page
CREATE POLICY "select_formularios_anon" ON public.formulario_campos
  FOR SELECT TO anon USING (true);

-- Allow anon to select the formulario itself for public form
CREATE POLICY "select_formularios_anon_public" ON public.formularios
  FOR SELECT TO anon USING (ativo = true);

-- Trigger for updated_at
CREATE TRIGGER update_formularios_updated_at
  BEFORE UPDATE ON public.formularios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
