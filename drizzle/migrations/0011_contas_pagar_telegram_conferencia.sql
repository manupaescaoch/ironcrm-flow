ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS cnpj text;
CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_cnpj_uniq ON public.fornecedores (cnpj) WHERE cnpj IS NOT NULL;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

CREATE TABLE public.contas_pagar_telegram_edicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.contas_pagar(id) ON DELETE CASCADE,
  telegram_chat_id bigint NOT NULL,
  telegram_user_id bigint NOT NULL,
  message_id bigint,
  campo_aguardando text,
  rascunho jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','salva','cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contas_pagar_telegram_edicoes_aberta ON public.contas_pagar_telegram_edicoes (conta_id) WHERE status = 'aberta';
CREATE INDEX contas_pagar_telegram_edicoes_aguardando ON public.contas_pagar_telegram_edicoes (telegram_chat_id, telegram_user_id) WHERE status = 'aberta' AND campo_aguardando IS NOT NULL;
GRANT ALL ON public.contas_pagar_telegram_edicoes TO service_role;
GRANT SELECT ON public.contas_pagar_telegram_edicoes TO authenticated;
ALTER TABLE public.contas_pagar_telegram_edicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin vê edições telegram" ON public.contas_pagar_telegram_edicoes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));