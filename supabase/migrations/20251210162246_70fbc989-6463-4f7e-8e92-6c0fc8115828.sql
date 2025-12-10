-- Add atendido_por column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS atendido_por text;

-- Create index for filtering (only if not exists)
CREATE INDEX IF NOT EXISTS idx_leads_atendido_por ON public.leads(atendido_por);
CREATE INDEX IF NOT EXISTS idx_leads_origem ON public.leads(origem);