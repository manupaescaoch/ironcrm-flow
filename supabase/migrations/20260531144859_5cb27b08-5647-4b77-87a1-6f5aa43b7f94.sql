-- Bucket privado para anexos de reuniões
INSERT INTO storage.buckets (id, name, public)
VALUES ('reuniao-anexos', 'reuniao-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Tabela de anexos
CREATE TABLE public.reuniao_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id UUID NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reuniao_anexos_reuniao ON public.reuniao_anexos(reuniao_id);

GRANT SELECT, INSERT, DELETE ON public.reuniao_anexos TO authenticated;
GRANT ALL ON public.reuniao_anexos TO service_role;

ALTER TABLE public.reuniao_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anexos: leitura por unidade"
ON public.reuniao_anexos FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.user_has_unidade_access(auth.uid(), unidade_id)
);

CREATE POLICY "Anexos: inserir por unidade"
ON public.reuniao_anexos FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.user_has_unidade_access(auth.uid(), unidade_id)
);

CREATE POLICY "Anexos: excluir por autor, admin ou coordenador"
ON public.reuniao_anexos FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'coordenador'::app_role)
);

-- Storage policies para o bucket reuniao-anexos
-- Caminho: <reuniao_id>/<arquivo>
CREATE POLICY "Reuniao anexos: leitura autenticada"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'reuniao-anexos'
  AND EXISTS (
    SELECT 1 FROM public.reuniao_anexos a
    WHERE a.file_path = storage.objects.name
  )
);

CREATE POLICY "Reuniao anexos: upload autenticado"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reuniao-anexos');

CREATE POLICY "Reuniao anexos: delete por autor/admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'reuniao-anexos'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'coordenador'::app_role)
    OR owner = auth.uid()
  )
);