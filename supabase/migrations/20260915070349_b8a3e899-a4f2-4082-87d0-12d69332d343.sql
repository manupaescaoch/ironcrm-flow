-- telegram_users
CREATE TABLE public.telegram_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  telegram_user_id bigint UNIQUE,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  connected_at timestamptz,
  status text NOT NULL DEFAULT 'nao_conectado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_users TO authenticated;
GRANT ALL ON public.telegram_users TO service_role;
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage telegram_users" ON public.telegram_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users read own telegram link" ON public.telegram_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER trg_telegram_users_updated BEFORE UPDATE ON public.telegram_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- telegram_connection_tokens
CREATE TABLE public.telegram_connection_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_telegram_tokens_user ON public.telegram_connection_tokens(user_id);
GRANT SELECT ON public.telegram_connection_tokens TO authenticated;
GRANT ALL ON public.telegram_connection_tokens TO service_role;
ALTER TABLE public.telegram_connection_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read telegram tokens" ON public.telegram_connection_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- telegram_groups
CREATE TABLE public.telegram_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_type text NOT NULL,
  name text NOT NULL,
  telegram_chat_id bigint,
  telegram_title text,
  status text NOT NULL DEFAULT 'nao_conectado',
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_telegram_groups_type_ativo ON public.telegram_groups(group_type) WHERE status = 'conectado';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_groups TO authenticated;
GRANT ALL ON public.telegram_groups TO service_role;
ALTER TABLE public.telegram_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage telegram_groups" ON public.telegram_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_telegram_groups_updated BEFORE UPDATE ON public.telegram_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.telegram_groups (group_type, name) VALUES
  ('coordenadores', 'Coordenadores'),
  ('comercial', 'Comercial'),
  ('gerencia', 'Gerência');

-- telegram_detected_chats
CREATE TABLE public.telegram_detected_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id bigint NOT NULL UNIQUE,
  title text,
  chat_type text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.telegram_detected_chats TO authenticated;
GRANT ALL ON public.telegram_detected_chats TO service_role;
ALTER TABLE public.telegram_detected_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read telegram_detected_chats" ON public.telegram_detected_chats FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- telegram_message_logs
CREATE TABLE public.telegram_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type text NOT NULL,
  recipient_id uuid,
  telegram_chat_id bigint,
  message_type text NOT NULL DEFAULT 'texto',
  status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_telegram_logs_created ON public.telegram_message_logs(created_at DESC);
GRANT SELECT ON public.telegram_message_logs TO authenticated;
GRANT ALL ON public.telegram_message_logs TO service_role;
ALTER TABLE public.telegram_message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read telegram_message_logs" ON public.telegram_message_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));