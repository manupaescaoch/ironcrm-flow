ALTER TABLE public.telegram_connection_tokens ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.telegram_connection_tokens ADD COLUMN IF NOT EXISTS funcionario_id uuid REFERENCES public.cronograma_funcionarios(id) ON DELETE CASCADE;
ALTER TABLE public.telegram_convites_whatsapp ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.telegram_convites_whatsapp ADD COLUMN IF NOT EXISTS funcionario_id uuid REFERENCES public.cronograma_funcionarios(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.telegram_funcionarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id uuid NOT NULL UNIQUE REFERENCES public.cronograma_funcionarios(id) ON DELETE CASCADE,
  nome text,
  telefone text,
  telegram_user_id bigint,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  status text NOT NULL DEFAULT 'nao_conectado',
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_funcionarios TO authenticated;
GRANT ALL ON public.telegram_funcionarios TO service_role;
ALTER TABLE public.telegram_funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam vinculos de funcionarios"
  ON public.telegram_funcionarios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_telegram_funcionarios_updated_at
  BEFORE UPDATE ON public.telegram_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_telegram_funcionarios_status ON public.telegram_funcionarios(status);