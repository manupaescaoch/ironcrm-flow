-- Create escala table for schedule management
CREATE TABLE public.escala (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano integer NOT NULL CHECK (ano >= 2020 AND ano <= 2100),
  final_de_semana text NOT NULL,
  treinador text,
  recepcao text,
  servicos_gerais text,
  seguranca text,
  feriado boolean NOT NULL DEFAULT false,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.escala ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view escala for their permitted unidades
CREATE POLICY "select_escala_by_unidade" ON public.escala
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

-- Policy: Only admins can insert
CREATE POLICY "insert_escala_admin" ON public.escala
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Only admins can update
CREATE POLICY "update_escala_admin" ON public.escala
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Only admins can delete
CREATE POLICY "delete_escala_admin" ON public.escala
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_escala_updated_at
BEFORE UPDATE ON public.escala
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_escala_unidade_mes_ano ON public.escala(unidade_id, ano, mes);