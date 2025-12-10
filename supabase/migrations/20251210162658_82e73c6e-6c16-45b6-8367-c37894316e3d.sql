-- Add new columns to interacoes table for complete interaction tracking
ALTER TABLE public.interacoes 
  ADD COLUMN IF NOT EXISTS atendido_por text,
  ADD COLUMN IF NOT EXISTS agendou_experimental boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_experimental date,
  ADD COLUMN IF NOT EXISTS hora_experimental time,
  ADD COLUMN IF NOT EXISTS compareceu boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reagendou boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fechou_matricula boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS plano_escolhido text,
  ADD COLUMN IF NOT EXISTS valor_plano numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_comercial numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_recepcao numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_fechamento date,
  ADD COLUMN IF NOT EXISTS responsavel_fechamento text,
  ADD COLUMN IF NOT EXISTS treinador_responsavel text;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_interacoes_data_experimental ON public.interacoes(data_experimental);
CREATE INDEX IF NOT EXISTS idx_interacoes_fechou_matricula ON public.interacoes(fechou_matricula);