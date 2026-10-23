CREATE TABLE public.contas_pagar_assistente_consultas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id bigint NOT NULL,
  telegram_message_id bigint NOT NULL,
  telegram_user_id bigint NOT NULL,
  user_id uuid,
  pergunta text NOT NULL,
  filtros jsonb,
  status text NOT NULL DEFAULT 'recebida',
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (telegram_chat_id, telegram_message_id)
);
GRANT ALL ON public.contas_pagar_assistente_consultas TO service_role;
GRANT SELECT ON public.contas_pagar_assistente_consultas TO authenticated;
ALTER TABLE public.contas_pagar_assistente_consultas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem consultas do assistente" ON public.contas_pagar_assistente_consultas
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_cp_assist_ctx ON public.contas_pagar_assistente_consultas (telegram_chat_id, telegram_user_id, created_at DESC);