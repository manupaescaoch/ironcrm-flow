-- Create follow_ups table for automated follow-up tracking
CREATE TABLE public.follow_ups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL DEFAULT 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6'::uuid REFERENCES public.unidades(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('D+7', 'D+15', 'D+30')),
  data_referencia TIMESTAMP WITH TIME ZONE NOT NULL,
  data_prevista TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'cancelado')),
  concluido_por TEXT,
  concluido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, tipo)
);

-- Enable RLS
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "select_follow_ups_by_unidade" ON public.follow_ups
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY "insert_follow_ups_by_unidade" ON public.follow_ups
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY "update_follow_ups_by_unidade" ON public.follow_ups
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
) WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY "delete_follow_ups_by_unidade" ON public.follow_ups
FOR DELETE USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_follow_ups_updated_at
  BEFORE UPDATE ON public.follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster queries
CREATE INDEX idx_follow_ups_lead_id ON public.follow_ups(lead_id);
CREATE INDEX idx_follow_ups_unidade_status ON public.follow_ups(unidade_id, status);
CREATE INDEX idx_follow_ups_data_prevista ON public.follow_ups(data_prevista);

-- Function to generate follow-ups for a lead
CREATE OR REPLACE FUNCTION public.generate_follow_ups_for_lead(p_lead_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_data_referencia TIMESTAMP WITH TIME ZONE;
  v_ultima_interacao TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get lead info
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND ativo = true;
  
  -- Skip if lead not found or status is convertido/perdido
  IF v_lead IS NULL OR v_lead.status_funil IN ('convertido', 'perdido') THEN
    RETURN;
  END IF;
  
  -- Get last relevant interaction (experimental realizada or last contact)
  SELECT MAX(data_interacao) INTO v_ultima_interacao
  FROM interacoes 
  WHERE lead_id = p_lead_id 
    AND (compareceu = true OR tipo IN ('contato', 'ligacao', 'whatsapp', 'email'));
  
  -- Use experimental date if available, otherwise use last interaction or created_at
  IF v_lead.data_aula_experimental IS NOT NULL AND EXISTS (
    SELECT 1 FROM interacoes WHERE lead_id = p_lead_id AND compareceu = true
  ) THEN
    v_data_referencia := v_lead.data_aula_experimental;
  ELSIF v_ultima_interacao IS NOT NULL THEN
    v_data_referencia := v_ultima_interacao;
  ELSE
    v_data_referencia := v_lead.created_at;
  END IF;
  
  -- Insert D+7 follow-up if doesn't exist
  INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista)
  VALUES (p_lead_id, v_lead.unidade_id, 'D+7', v_data_referencia, v_data_referencia + INTERVAL '7 days')
  ON CONFLICT (lead_id, tipo) DO NOTHING;
  
  -- Insert D+15 follow-up if doesn't exist
  INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista)
  VALUES (p_lead_id, v_lead.unidade_id, 'D+15', v_data_referencia, v_data_referencia + INTERVAL '15 days')
  ON CONFLICT (lead_id, tipo) DO NOTHING;
  
  -- Insert D+30 follow-up if doesn't exist
  INSERT INTO follow_ups (lead_id, unidade_id, tipo, data_referencia, data_prevista)
  VALUES (p_lead_id, v_lead.unidade_id, 'D+30', v_data_referencia, v_data_referencia + INTERVAL '30 days')
  ON CONFLICT (lead_id, tipo) DO NOTHING;
END;
$$;

-- Function to cancel follow-ups when lead is converted or lost
CREATE OR REPLACE FUNCTION public.cancel_follow_ups_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_funil IN ('convertido', 'perdido') AND OLD.status_funil NOT IN ('convertido', 'perdido') THEN
    UPDATE follow_ups 
    SET status = 'cancelado', updated_at = now()
    WHERE lead_id = NEW.id AND status = 'pendente';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to cancel follow-ups when lead status changes
CREATE TRIGGER cancel_follow_ups_on_lead_status
  AFTER UPDATE OF status_funil ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_follow_ups_on_status_change();