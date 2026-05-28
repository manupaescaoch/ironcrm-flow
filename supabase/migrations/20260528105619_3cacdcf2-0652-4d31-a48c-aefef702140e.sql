ALTER TABLE public.unidade_whatsapp_config 
  ADD COLUMN IF NOT EXISTS grupo_anamnese_id text,
  ADD COLUMN IF NOT EXISTS grupo_anamnese_nome text;