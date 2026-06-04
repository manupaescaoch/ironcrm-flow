-- Ensure table structures
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS first_inbound_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status_conversa TEXT DEFAULT 'aguardando_resposta',
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id),
ADD COLUMN IF NOT EXISTS unidade_id UUID;

ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id),
ADD COLUMN IF NOT EXISTS unidade_id UUID,
ADD COLUMN IF NOT EXISTS status TEXT;

-- Grant permissions (if not already granted)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO service_role;

-- Enable RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Authenticated users can read whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "Authenticated users can read whatsapp_conversations" ON public.whatsapp_conversations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Authenticated users can read whatsapp_messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (true);
