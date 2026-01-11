-- Create table for marketing investment history
CREATE TABLE public.investimentos_marketing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidade_id UUID NOT NULL DEFAULT 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6'::uuid,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID DEFAULT auth.uid(),
  CONSTRAINT unique_periodo_unidade UNIQUE (unidade_id, data_inicio, data_fim)
);

-- Enable Row Level Security
ALTER TABLE public.investimentos_marketing ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "select_investimentos_by_unidade" 
ON public.investimentos_marketing 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY "insert_investimentos_by_unidade" 
ON public.investimentos_marketing 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY "update_investimentos_by_unidade" 
ON public.investimentos_marketing 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY "delete_investimentos_by_unidade" 
ON public.investimentos_marketing 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_investimentos_marketing_updated_at
BEFORE UPDATE ON public.investimentos_marketing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();