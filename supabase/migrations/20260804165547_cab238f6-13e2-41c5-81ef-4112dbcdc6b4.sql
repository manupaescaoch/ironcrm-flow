-- 1. Campos de transferência
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS conta_bancaria text,
  ADD COLUMN IF NOT EXISTS favorecido text;

-- 2. Grupo de contas a pagar por unidade
ALTER TABLE public.unidade_whatsapp_config
  ADD COLUMN IF NOT EXISTS grupo_contas_pagar_id text,
  ADD COLUMN IF NOT EXISTS grupo_contas_pagar_nome text;

-- 3. Tabela de envios (fila + histórico)
CREATE TABLE IF NOT EXISTS public.contas_pagar_envios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id uuid NOT NULL REFERENCES public.contas_pagar(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL,
  tipo_envio text NOT NULL CHECK (tipo_envio IN ('CADASTRO','VENCIMENTO')),
  status text NOT NULL DEFAULT 'aguardando_envio'
    CHECK (status IN ('aguardando_envio','enviando','enviado','falhou','cancelado_pago','cancelado_cancelada')),
  tentativas integer NOT NULL DEFAULT 0,
  proxima_tentativa_em timestamp with time zone,
  ultima_tentativa_em timestamp with time zone,
  instancia_id text,
  grupo_destino text,
  zapi_message_id text,
  mensagem_enviada text,
  erro_msg text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contas_pagar_envios_conta_tipo_key UNIQUE (conta_id, tipo_envio)
);

GRANT SELECT ON public.contas_pagar_envios TO authenticated;
GRANT ALL ON public.contas_pagar_envios TO service_role;

ALTER TABLE public.contas_pagar_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_contas_pagar_envios_by_unidade"
ON public.contas_pagar_envios
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_envios_fila
  ON public.contas_pagar_envios (status, proxima_tentativa_em);

CREATE TRIGGER trg_contas_pagar_envios_updated_at
BEFORE UPDATE ON public.contas_pagar_envios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Reserva atômica de envio (usada apenas pelo backend / service_role)
CREATE OR REPLACE FUNCTION public.reservar_envio_conta(p_conta_id uuid, p_tipo text)
RETURNS public.contas_pagar_envios
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_row public.contas_pagar_envios;
  v_unidade uuid;
BEGIN
  IF p_tipo NOT IN ('CADASTRO','VENCIMENTO') THEN
    RAISE EXCEPTION 'tipo_envio inválido';
  END IF;

  SELECT unidade_id INTO v_unidade FROM public.contas_pagar WHERE id = p_conta_id;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  INSERT INTO public.contas_pagar_envios (conta_id, unidade_id, tipo_envio, status, proxima_tentativa_em)
  VALUES (p_conta_id, v_unidade, p_tipo, 'aguardando_envio', now())
  ON CONFLICT (conta_id, tipo_envio) DO NOTHING;

  UPDATE public.contas_pagar_envios
     SET status = 'enviando',
         tentativas = tentativas + 1,
         ultima_tentativa_em = now(),
         updated_at = now()
   WHERE conta_id = p_conta_id
     AND tipo_envio = p_tipo
     AND status IN ('aguardando_envio','falhou')
  RETURNING * INTO v_row;

  RETURN v_row; -- NULL quando já enviado / enviando / cancelado
END;
$$;

REVOKE ALL ON FUNCTION public.reservar_envio_conta(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reservar_envio_conta(uuid, text) TO service_role;

-- 5. Cancelamento automático do envio de vencimento
CREATE OR REPLACE FUNCTION public.cancel_envio_conta_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_novo text;
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    v_novo := 'cancelado_cancelada';
  ELSIF NEW.status = 'paga' AND OLD.status <> 'paga' THEN
    v_novo := 'cancelado_pago';
  ELSIF NEW.status = 'cancelada' AND OLD.status <> 'cancelada' THEN
    v_novo := 'cancelado_cancelada';
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.contas_pagar_envios
     SET status = v_novo, updated_at = now()
   WHERE conta_id = NEW.id
     AND tipo_envio = 'VENCIMENTO'
     AND status IN ('aguardando_envio','falhou');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cancel_envio_conta_on_status
AFTER UPDATE ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.cancel_envio_conta_on_status();