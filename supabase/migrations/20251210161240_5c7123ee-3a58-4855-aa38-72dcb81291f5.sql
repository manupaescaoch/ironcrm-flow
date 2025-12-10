-- Create enum-like types using TEXT with CHECK constraints via trigger
-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  origem TEXT,
  status_funil TEXT NOT NULL DEFAULT 'novo',
  plano_escolhido TEXT,
  data_aula_experimental TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create interacoes table
CREATE TABLE public.interacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT,
  data_interacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create validation trigger for status_funil
CREATE OR REPLACE FUNCTION public.validate_status_funil()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_funil NOT IN ('novo', 'contato_inicial', 'aula_agendada', 'aula_realizada', 'negociacao', 'convertido', 'perdido') THEN
    RAISE EXCEPTION 'Invalid status_funil value: %', NEW.status_funil;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_leads_status_funil
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_status_funil();

-- Create validation trigger for plano_escolhido
CREATE OR REPLACE FUNCTION public.validate_plano_escolhido()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plano_escolhido IS NOT NULL AND NEW.plano_escolhido NOT IN ('Executivo Mensal', 'Mensal', 'Trimestral', 'Semestral', 'Anual', 'Executivo Anual') THEN
    RAISE EXCEPTION 'Invalid plano_escolhido value: %', NEW.plano_escolhido;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_leads_plano_escolhido
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_plano_escolhido();

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interacoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads
CREATE POLICY "Users can view their own leads" 
  ON public.leads 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own leads" 
  ON public.leads 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads" 
  ON public.leads 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads" 
  ON public.leads 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for interacoes (based on lead ownership)
CREATE POLICY "Users can view interacoes of their leads" 
  ON public.interacoes 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = interacoes.lead_id 
    AND leads.user_id = auth.uid()
  ));

CREATE POLICY "Users can create interacoes for their leads" 
  ON public.interacoes 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = interacoes.lead_id 
    AND leads.user_id = auth.uid()
  ));

CREATE POLICY "Users can update interacoes of their leads" 
  ON public.interacoes 
  FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = interacoes.lead_id 
    AND leads.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete interacoes of their leads" 
  ON public.interacoes 
  FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = interacoes.lead_id 
    AND leads.user_id = auth.uid()
  ));

-- Create indexes for better performance
CREATE INDEX idx_leads_user_id ON public.leads(user_id);
CREATE INDEX idx_leads_status_funil ON public.leads(status_funil);
CREATE INDEX idx_leads_ativo ON public.leads(ativo);
CREATE INDEX idx_interacoes_lead_id ON public.interacoes(lead_id);