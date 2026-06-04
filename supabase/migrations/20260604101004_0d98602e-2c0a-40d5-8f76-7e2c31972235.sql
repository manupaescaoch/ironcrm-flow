-- Add is_cliente column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_conversations' AND column_name = 'is_cliente') THEN
        ALTER TABLE public.whatsapp_conversations ADD COLUMN is_cliente BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

-- Policies for whatsapp_conversations
DROP POLICY IF EXISTS "Permitir leitura para usuários autenticados" ON public.whatsapp_conversations;
CREATE POLICY "Permitir leitura para usuários autenticados" ON public.whatsapp_conversations
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir inserção/atualização para usuários autenticados" ON public.whatsapp_conversations;
CREATE POLICY "Permitir inserção/atualização para usuários autenticados" ON public.whatsapp_conversations
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies for whatsapp_messages
DROP POLICY IF EXISTS "Permitir leitura para usuários autenticados" ON public.whatsapp_messages;
CREATE POLICY "Permitir leitura para usuários autenticados" ON public.whatsapp_messages
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON public.whatsapp_messages;
CREATE POLICY "Permitir inserção para usuários autenticados" ON public.whatsapp_messages
FOR INSERT TO authenticated WITH CHECK (true);

-- Ensure publication for realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_conversations') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
    END IF;
END $$;