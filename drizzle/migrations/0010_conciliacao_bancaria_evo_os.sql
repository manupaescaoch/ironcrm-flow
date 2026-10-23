CREATE TABLE public.transacoes_bancarias_evo_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  unidade_id uuid,
  unidade_origem text,
  conta_bancaria text,
  data date NOT NULL,
  valor numeric NOT NULL CHECK (valor >= 0),
  tipo text NOT NULL DEFAULT 'debito' CHECK (tipo IN ('debito','credito')),
  descricao text,
  beneficiario text,
  documento text,
  pix_id text,
  autenticacao text,
  raw jsonb,
  conta_pagar_id uuid UNIQUE REFERENCES public.contas_pagar(id) ON DELETE SET NULL,
  conciliado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.transacoes_bancarias_evo_os IS 'Espelho somente leitura das transações bancárias enviadas pelo EVO OS (fonte oficial). Usado apenas para conciliação.';
GRANT ALL ON public.transacoes_bancarias_evo_os TO service_role;
GRANT SELECT ON public.transacoes_bancarias_evo_os TO authenticated;
ALTER TABLE public.transacoes_bancarias_evo_os ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Financeiro vê transações das suas unidades" ON public.transacoes_bancarias_evo_os
  FOR SELECT TO authenticated USING (
    public.can_manage_contas_pagar(auth.uid())
    AND (public.has_role(auth.uid(),'admin') OR (unidade_id IS NOT NULL AND public.user_has_unidade_access(auth.uid(), unidade_id)))
  );
CREATE INDEX idx_tb_evo_os_match ON public.transacoes_bancarias_evo_os (unidade_id, data) WHERE conta_pagar_id IS NULL AND tipo = 'debito';

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS conciliacao_status text NOT NULL DEFAULT 'nao_conciliado',
  ADD COLUMN IF NOT EXISTS conciliado_em timestamptz,
  ADD COLUMN IF NOT EXISTS conciliado_por_nome text,
  ADD COLUMN IF NOT EXISTS valor_debitado numeric,
  ADD COLUMN IF NOT EXISTS diferenca_classificacao text,
  ADD COLUMN IF NOT EXISTS transacao_bancaria_id uuid,
  ADD COLUMN IF NOT EXISTS conciliacao_sugestoes uuid[],
  ADD COLUMN IF NOT EXISTS conciliacao_notificado_em timestamptz;
ALTER TABLE public.contas_pagar ADD CONSTRAINT contas_pagar_conciliacao_status_chk
  CHECK (conciliacao_status IN ('nao_conciliado','aguardando_transacao','divergencia','conciliado'));
ALTER TABLE public.contas_pagar ADD CONSTRAINT contas_pagar_diferenca_class_chk
  CHECK (diferenca_classificacao IS NULL OR diferenca_classificacao IN ('juros_multa','desconto','parcial'));
CREATE INDEX IF NOT EXISTS idx_contas_pagar_conciliacao ON public.contas_pagar (unidade_id, conciliacao_status) WHERE status = 'paga';
UPDATE public.contas_pagar SET conciliacao_status = 'aguardando_transacao' WHERE status = 'paga' AND baixa_origem = 'telegram_declarado';