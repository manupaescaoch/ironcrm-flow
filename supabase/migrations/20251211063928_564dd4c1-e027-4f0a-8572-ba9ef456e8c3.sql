-- Add cadastrado_por column to leads table (name of who registered the lead)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cadastrado_por text;

-- Add new commission columns to interacoes table
ALTER TABLE public.interacoes ADD COLUMN IF NOT EXISTS cadastrado_por text;
ALTER TABLE public.interacoes ADD COLUMN IF NOT EXISTS comissao_cadastrador numeric DEFAULT 0;

-- Rename comissao_comercial to comissao_fechador for clarity (keep both for backward compatibility)
-- Actually, let's keep comissao_comercial and just update the logic in code
-- We'll use comissao_comercial as the cadastrador commission (3%)
-- and comissao_recepcao as the fechador commission (2%)

-- Comment explaining the new logic:
-- comissao_comercial = comissao_cadastrador (3%) - goes to whoever registered the lead
-- comissao_recepcao = comissao_fechador (2%) - goes to responsavel_fechamento