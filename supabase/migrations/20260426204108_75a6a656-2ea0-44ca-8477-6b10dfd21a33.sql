CREATE TABLE public.resumo_semanal_pendentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL,
  semana_inicio date NOT NULL,
  semana_fim date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  valor_zn numeric,
  valor_zs numeric,
  resposta_raw text,
  respondido_em timestamptz,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_resumo_pendentes_status ON public.resumo_semanal_pendentes(status, telefone);

ALTER TABLE public.resumo_semanal_pendentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view resumo pendentes"
ON public.resumo_semanal_pendentes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_resumo_pendentes_updated_at
BEFORE UPDATE ON public.resumo_semanal_pendentes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();