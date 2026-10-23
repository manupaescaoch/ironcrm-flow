ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS fornecedor_documento text;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS data_emissao date;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS import_key text;
CREATE UNIQUE INDEX IF NOT EXISTS contas_pagar_unidade_import_key_uidx ON public.contas_pagar (unidade_id, import_key) WHERE import_key IS NOT NULL;