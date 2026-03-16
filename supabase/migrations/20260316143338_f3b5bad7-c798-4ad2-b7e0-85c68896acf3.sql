
-- Create rotinas table
CREATE TABLE public.rotinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  nome text NOT NULL,
  descricao text,
  setor text NOT NULL DEFAULT 'geral',
  responsavel_principal text,
  responsavel_conferencia text,
  frequencia text NOT NULL DEFAULT 'diaria',
  horario_esperado time,
  prioridade text NOT NULL DEFAULT 'media',
  ativo boolean NOT NULL DEFAULT true,
  arquivada boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create rotina_atividades table
CREATE TABLE public.rotina_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id uuid NOT NULL REFERENCES public.rotinas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  responsavel text,
  horario time,
  observacao text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create rotina_execucoes table
CREATE TABLE public.rotina_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id uuid NOT NULL REFERENCES public.rotinas(id) ON DELETE CASCADE,
  atividade_id uuid REFERENCES public.rotina_atividades(id) ON DELETE CASCADE,
  data_execucao date NOT NULL DEFAULT CURRENT_DATE,
  concluida boolean NOT NULL DEFAULT false,
  concluida_por text,
  concluida_em timestamptz,
  observacao text,
  foto_url text,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rotinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotina_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotina_execucoes ENABLE ROW LEVEL SECURITY;

-- RLS for rotinas
CREATE POLICY "select_rotinas_by_unidade" ON public.rotinas FOR SELECT
  USING (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));

CREATE POLICY "insert_rotinas_by_unidade" ON public.rotinas FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));

CREATE POLICY "update_rotinas_by_unidade" ON public.rotinas FOR UPDATE
  USING (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))))
  WITH CHECK (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));

CREATE POLICY "delete_rotinas_admin_coord" ON public.rotinas FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role));

-- RLS for rotina_atividades (via join)
CREATE POLICY "select_rotina_atividades" ON public.rotina_atividades FOR SELECT
  USING (EXISTS (SELECT 1 FROM rotinas r WHERE r.id = rotina_atividades.rotina_id AND (has_role(auth.uid(), 'admin'::app_role) OR r.unidade_id IN (SELECT get_user_unidades(auth.uid())))));

CREATE POLICY "insert_rotina_atividades" ON public.rotina_atividades FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM rotinas r WHERE r.id = rotina_atividades.rotina_id AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role) OR r.unidade_id IN (SELECT get_user_unidades(auth.uid())))));

CREATE POLICY "update_rotina_atividades" ON public.rotina_atividades FOR UPDATE
  USING (EXISTS (SELECT 1 FROM rotinas r WHERE r.id = rotina_atividades.rotina_id AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role) OR r.unidade_id IN (SELECT get_user_unidades(auth.uid())))));

CREATE POLICY "delete_rotina_atividades" ON public.rotina_atividades FOR DELETE
  USING (EXISTS (SELECT 1 FROM rotinas r WHERE r.id = rotina_atividades.rotina_id AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role))));

-- RLS for rotina_execucoes
CREATE POLICY "select_rotina_execucoes" ON public.rotina_execucoes FOR SELECT
  USING (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));

CREATE POLICY "insert_rotina_execucoes" ON public.rotina_execucoes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));

CREATE POLICY "update_rotina_execucoes" ON public.rotina_execucoes FOR UPDATE
  USING (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));

-- Triggers
CREATE TRIGGER update_rotinas_updated_at BEFORE UPDATE ON public.rotinas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rotina_execucoes;

-- Storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('rotinas-comprovantes', 'rotinas-comprovantes', true);

-- Storage RLS
CREATE POLICY "Authenticated users can upload rotinas photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'rotinas-comprovantes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view rotinas photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'rotinas-comprovantes');
