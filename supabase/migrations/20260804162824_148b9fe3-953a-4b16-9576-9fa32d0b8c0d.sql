-- Helper: permissão financeira (admin ou comercial=user)
CREATE OR REPLACE FUNCTION public.can_manage_contas_pagar(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'user'::public.app_role)
  )
$$;

CREATE TABLE public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  descricao text NOT NULL,
  fornecedor text NOT NULL,
  categoria text NOT NULL,
  prioridade text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa','normal','importante','urgente')),
  centro_custo text,
  competencia text,
  observacoes text,
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  data_vencimento date NOT NULL,
  forma_pagamento text NOT NULL CHECK (forma_pagamento IN ('boleto','pix','transferencia','cartao','debito_automatico','dinheiro','outro')),
  numero_fatura text,
  codigo_barras text,
  linha_digitavel text,
  chave_pix text,
  codigo_pix text,
  documento_url text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','paga','cancelada')),
  valor_pago numeric(14,2),
  data_pagamento date,
  forma_pagamento_baixa text,
  juros numeric(14,2) NOT NULL DEFAULT 0,
  multa numeric(14,2) NOT NULL DEFAULT 0,
  desconto numeric(14,2) NOT NULL DEFAULT 0,
  comprovante_url text,
  baixa_observacoes text,
  created_by uuid,
  created_by_nome text,
  baixado_por uuid,
  baixado_por_nome text,
  baixado_em timestamptz,
  cancelado_em timestamptz,
  cancelado_por_nome text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contas_pagar_unidade_venc ON public.contas_pagar (unidade_id, data_vencimento);
CREATE INDEX idx_contas_pagar_status ON public.contas_pagar (status);

CREATE TABLE public.contas_pagar_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.contas_pagar(id) ON DELETE CASCADE,
  acao text NOT NULL,
  campo text,
  valor_anterior text,
  valor_novo text,
  user_id uuid,
  user_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contas_pagar_hist_conta ON public.contas_pagar_historico (conta_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.contas_pagar TO authenticated;
GRANT ALL ON public.contas_pagar TO service_role;
GRANT SELECT ON public.contas_pagar_historico TO authenticated;
GRANT ALL ON public.contas_pagar_historico TO service_role;

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY contas_pagar_select_scoped ON public.contas_pagar
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

CREATE POLICY contas_pagar_insert_own_unidade ON public.contas_pagar
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
  AND status = 'pendente'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

CREATE POLICY contas_pagar_update_financeiro ON public.contas_pagar
FOR UPDATE TO authenticated
USING (
  public.can_manage_contas_pagar(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
)
WITH CHECK (
  public.can_manage_contas_pagar(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

CREATE POLICY contas_pagar_hist_select ON public.contas_pagar_historico
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contas_pagar c
    WHERE c.id = conta_id
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR c.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
      )
  )
);

CREATE TRIGGER trg_contas_pagar_updated_at
BEFORE UPDATE ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_contas_pagar_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nome text;
BEGIN
  v_nome := COALESCE(
    (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
       FROM auth.users WHERE id = auth.uid()),
    'SISTEMA'
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.contas_pagar_historico (conta_id, acao, user_id, user_nome)
    VALUES (NEW.id, 'criacao', auth.uid(), v_nome);
    RETURN NEW;
  END IF;

  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO public.contas_pagar_historico (conta_id, acao, user_id, user_nome)
    VALUES (NEW.id, 'exclusao', auth.uid(), v_nome);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.contas_pagar_historico (conta_id, acao, campo, valor_anterior, valor_novo, user_id, user_nome)
    VALUES (
      NEW.id,
      CASE
        WHEN NEW.status = 'paga' THEN 'baixa'
        WHEN NEW.status = 'cancelada' THEN 'cancelamento'
        WHEN OLD.status = 'paga' AND NEW.status = 'pendente' THEN 'reabertura'
        ELSE 'edicao'
      END,
      'status', OLD.status, NEW.status, auth.uid(), v_nome
    );
  END IF;

  IF OLD.valor IS DISTINCT FROM NEW.valor THEN
    INSERT INTO public.contas_pagar_historico (conta_id, acao, campo, valor_anterior, valor_novo, user_id, user_nome)
    VALUES (NEW.id, 'alteracao_valor', 'valor', OLD.valor::text, NEW.valor::text, auth.uid(), v_nome);
  END IF;

  IF OLD.data_vencimento IS DISTINCT FROM NEW.data_vencimento THEN
    INSERT INTO public.contas_pagar_historico (conta_id, acao, campo, valor_anterior, valor_novo, user_id, user_nome)
    VALUES (NEW.id, 'alteracao_vencimento', 'data_vencimento', OLD.data_vencimento::text, NEW.data_vencimento::text, auth.uid(), v_nome);
  END IF;

  IF OLD.descricao IS DISTINCT FROM NEW.descricao THEN
    INSERT INTO public.contas_pagar_historico (conta_id, acao, campo, valor_anterior, valor_novo, user_id, user_nome)
    VALUES (NEW.id, 'edicao', 'descricao', OLD.descricao, NEW.descricao, auth.uid(), v_nome);
  END IF;

  IF OLD.fornecedor IS DISTINCT FROM NEW.fornecedor THEN
    INSERT INTO public.contas_pagar_historico (conta_id, acao, campo, valor_anterior, valor_novo, user_id, user_nome)
    VALUES (NEW.id, 'edicao', 'fornecedor', OLD.fornecedor, NEW.fornecedor, auth.uid(), v_nome);
  END IF;

  IF OLD.categoria IS DISTINCT FROM NEW.categoria THEN
    INSERT INTO public.contas_pagar_historico (conta_id, acao, campo, valor_anterior, valor_novo, user_id, user_nome)
    VALUES (NEW.id, 'edicao', 'categoria', OLD.categoria, NEW.categoria, auth.uid(), v_nome);
  END IF;

  IF OLD.forma_pagamento IS DISTINCT FROM NEW.forma_pagamento THEN
    INSERT INTO public.contas_pagar_historico (conta_id, acao, campo, valor_anterior, valor_novo, user_id, user_nome)
    VALUES (NEW.id, 'edicao', 'forma_pagamento', OLD.forma_pagamento, NEW.forma_pagamento, auth.uid(), v_nome);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contas_pagar_historico_ins
AFTER INSERT ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.log_contas_pagar_changes();

CREATE TRIGGER trg_contas_pagar_historico_upd
AFTER UPDATE ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.log_contas_pagar_changes();