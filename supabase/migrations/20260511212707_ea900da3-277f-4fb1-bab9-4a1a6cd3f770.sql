
CREATE TABLE IF NOT EXISTS public.formulario_lembretes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  data date NOT NULL,
  unidade_id uuid NOT NULL,
  unidade_nome text,
  turno text,
  atividade_id uuid,
  formulario_tipo text NOT NULL,
  formulario_titulo text,
  responsavel_id uuid,
  responsavel_nome text,
  responsavel_telefone text,
  horario_previsto time,
  horario_lembrete timestamptz NOT NULL DEFAULT now(),
  status_preenchimento text,
  status_lembrete text NOT NULL,
  tentativas integer NOT NULL DEFAULT 1,
  erro_zapi text,
  zapi_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formulario_lembretes_data ON public.formulario_lembretes(data);
CREATE INDEX IF NOT EXISTS idx_formulario_lembretes_unidade ON public.formulario_lembretes(unidade_id);

ALTER TABLE public.formulario_lembretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_formulario_lembretes_admin"
  ON public.formulario_lembretes FOR SELECT
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "insert_formulario_lembretes_admin"
  ON public.formulario_lembretes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "update_formulario_lembretes_admin"
  ON public.formulario_lembretes FOR UPDATE
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "delete_formulario_lembretes_admin"
  ON public.formulario_lembretes FOR DELETE
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_formulario_lembretes_updated_at
  BEFORE UPDATE ON public.formulario_lembretes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
