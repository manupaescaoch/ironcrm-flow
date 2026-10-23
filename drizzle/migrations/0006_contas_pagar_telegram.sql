ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS telegram_remetente text,
  ADD COLUMN IF NOT EXISTS recebido_em timestamptz,
  ADD COLUMN IF NOT EXISTS chave_nfe text,
  ADD COLUMN IF NOT EXISTS pagador_cnpj text,
  ADD COLUMN IF NOT EXISTS fornecedor_validar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conferencia_status text,
  ADD COLUMN IF NOT EXISTS conferido_por_nome text,
  ADD COLUMN IF NOT EXISTS conferido_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por_nome text,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
ALTER TABLE public.contas_pagar ADD CONSTRAINT contas_pagar_conferencia_status_check
  CHECK (conferencia_status IS NULL OR conferencia_status IN ('pendente_conferencia','conferida','aprovada'));
CREATE INDEX IF NOT EXISTS idx_contas_pagar_linha ON public.contas_pagar(unidade_id, linha_digitavel) WHERE linha_digitavel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contas_pagar_chave_nfe ON public.contas_pagar(chave_nfe) WHERE chave_nfe IS NOT NULL;

CREATE TABLE public.contas_pagar_telegram_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id bigint NOT NULL,
  telegram_message_id bigint NOT NULL,
  update_id bigint,
  file_id text NOT NULL,
  file_name text,
  mime_type text,
  storage_path text,
  remetente text,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'recebido',
  dados jsonb,
  unidade_id uuid,
  unidade_metodo text,
  conta_id uuid REFERENCES public.contas_pagar(id),
  resultado text,
  erro text,
  tentativas integer NOT NULL DEFAULT 0,
  prompt_message_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (telegram_chat_id, telegram_message_id),
  CONSTRAINT cptd_status_check CHECK (status IN ('recebido','processando','aguardando_unidade','aguardando_vencimento','criado','vinculado','duplicado','conferencia_manual','erro','ignorado'))
);
GRANT SELECT ON public.contas_pagar_telegram_docs TO authenticated;
GRANT ALL ON public.contas_pagar_telegram_docs TO service_role;
ALTER TABLE public.contas_pagar_telegram_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY cptd_select_financeiro ON public.contas_pagar_telegram_docs FOR SELECT TO authenticated
  USING (public.can_manage_contas_pagar(auth.uid()) AND (public.has_role(auth.uid(),'admin') OR unidade_id IS NULL OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))));
CREATE TRIGGER cptd_updated_at BEFORE UPDATE ON public.contas_pagar_telegram_docs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_cptd_status ON public.contas_pagar_telegram_docs(status, created_at DESC);