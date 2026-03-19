
-- Table: cronograma_funcionarios
CREATE TABLE public.cronograma_funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id),
  nome TEXT NOT NULL,
  telefone TEXT,
  setor TEXT NOT NULL DEFAULT 'geral',
  turno TEXT NOT NULL DEFAULT 'integral',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cronograma_funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_cronograma_func_by_unidade" ON public.cronograma_funcionarios
  FOR SELECT USING (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));

CREATE POLICY "insert_cronograma_func_admin" ON public.cronograma_funcionarios
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "update_cronograma_func_admin" ON public.cronograma_funcionarios
  FOR UPDATE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "delete_cronograma_func_admin" ON public.cronograma_funcionarios
  FOR DELETE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cronograma_funcionarios_updated_at
  BEFORE UPDATE ON public.cronograma_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: cronograma_atividades
CREATE TABLE public.cronograma_atividades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id),
  formulario_id UUID REFERENCES public.formularios(id),
  responsavel_id UUID REFERENCES public.cronograma_funcionarios(id),
  titulo TEXT NOT NULL,
  horario TIME,
  dia_semana INTEGER, -- 0=dom, 1=seg, ..., 6=sab; null=todos
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cronograma_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_cronograma_ativ_by_unidade" ON public.cronograma_atividades
  FOR SELECT USING (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));

CREATE POLICY "insert_cronograma_ativ_admin" ON public.cronograma_atividades
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "update_cronograma_ativ_admin" ON public.cronograma_atividades
  FOR UPDATE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "delete_cronograma_ativ_admin" ON public.cronograma_atividades
  FOR DELETE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cronograma_atividades_updated_at
  BEFORE UPDATE ON public.cronograma_atividades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: cronograma_envios
CREATE TABLE public.cronograma_envios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atividade_id UUID REFERENCES public.cronograma_atividades(id),
  formulario_id UUID NOT NULL REFERENCES public.formularios(id),
  funcionario_id UUID NOT NULL REFERENCES public.cronograma_funcionarios(id),
  unidade_id UUID NOT NULL REFERENCES public.unidades(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  enviado_em TIMESTAMPTZ,
  respondido_em TIMESTAMPTZ,
  resposta_id UUID REFERENCES public.formulario_respostas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cronograma_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_cronograma_envios_by_unidade" ON public.cronograma_envios
  FOR SELECT USING (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));

CREATE POLICY "insert_cronograma_envios_admin" ON public.cronograma_envios
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "update_cronograma_envios_admin" ON public.cronograma_envios
  FOR UPDATE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "delete_cronograma_envios_admin" ON public.cronograma_envios
  FOR DELETE USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));
