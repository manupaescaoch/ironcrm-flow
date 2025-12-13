-- Create table for storing monthly management reports for Zona Norte
CREATE TABLE public.relatorio_gerencial_zn (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_ano TEXT NOT NULL UNIQUE, -- Format: YYYY-MM
  ativos INTEGER NOT NULL DEFAULT 0 CHECK (ativos >= 0),
  adimplentes INTEGER NOT NULL DEFAULT 0 CHECK (adimplentes >= 0),
  inadimplentes INTEGER NOT NULL DEFAULT 0 CHECK (inadimplentes >= 0),
  vip INTEGER NOT NULL DEFAULT 0 CHECK (vip >= 0),
  suspensos INTEGER NOT NULL DEFAULT 0 CHECK (suspensos >= 0),
  cancelamentos INTEGER NOT NULL DEFAULT 0 CHECK (cancelamentos >= 0),
  renovacoes INTEGER NOT NULL DEFAULT 0 CHECK (renovacoes >= 0),
  total_a_vencer INTEGER DEFAULT 0 CHECK (total_a_vencer >= 0),
  churn_percentual NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (churn_percentual >= 0),
  tempo_medio_vida NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tempo_medio_vida >= 0),
  observacoes TEXT,
  capacidade_zn INTEGER NOT NULL DEFAULT 300, -- Fixed capacity for ZN
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraint: adimplentes + inadimplentes + suspensos <= ativos
  CONSTRAINT check_base_clientes CHECK (adimplentes + inadimplentes + suspensos <= ativos)
);

-- Enable RLS
ALTER TABLE public.relatorio_gerencial_zn ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view
CREATE POLICY "Authenticated users can view reports"
ON public.relatorio_gerencial_zn
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can insert
CREATE POLICY "Admins can insert reports"
ON public.relatorio_gerencial_zn
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "Admins can update reports"
ON public.relatorio_gerencial_zn
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete reports"
ON public.relatorio_gerencial_zn
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_relatorio_gerencial_zn_updated_at
BEFORE UPDATE ON public.relatorio_gerencial_zn
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();