CREATE TABLE public.reuniao_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id uuid NOT NULL,
  unidade_id uuid NOT NULL,
  autor_id uuid NOT NULL,
  autor_nome text NOT NULL,
  conteudo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reuniao_comentarios_reuniao ON public.reuniao_comentarios(reuniao_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reuniao_comentarios TO authenticated;
GRANT ALL ON public.reuniao_comentarios TO service_role;

ALTER TABLE public.reuniao_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_reuniao_comentarios ON public.reuniao_comentarios
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY insert_reuniao_comentarios ON public.reuniao_comentarios
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND autor_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY update_reuniao_comentarios ON public.reuniao_comentarios
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR autor_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR autor_id = auth.uid()
  )
);

CREATE POLICY delete_reuniao_comentarios ON public.reuniao_comentarios
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR autor_id = auth.uid()
  )
);

CREATE TRIGGER trg_reuniao_comentarios_updated
BEFORE UPDATE ON public.reuniao_comentarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();