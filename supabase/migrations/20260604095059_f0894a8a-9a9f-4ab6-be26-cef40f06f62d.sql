CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    phone_normalized TEXT NOT NULL,
    contact_name TEXT,
    unidade_id UUID REFERENCES public.unidades(id),
    lead_id UUID REFERENCES public.leads(id),
    last_message_text TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_direction TEXT CHECK (last_message_direction IN ('inbound', 'outbound')),
    first_inbound_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    status_conversa TEXT DEFAULT 'aguardando_resposta' CHECK (status_conversa IN ('aguardando_resposta', 'respondido', 'em_atendimento', 'encerrado')),
    is_linked_to_lead BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT UNIQUE,
    phone TEXT NOT NULL,
    phone_normalized TEXT NOT NULL,
    contact_name TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_text TEXT,
    message_type TEXT,
    timestamp TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    unidade_id UUID REFERENCES public.unidades(id),
    lead_id UUID REFERENCES public.leads(id),
    status TEXT,
    replied_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wa_conv_phone_norm ON public.whatsapp_conversations(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_wa_conv_unidade ON public.whatsapp_conversations(unidade_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_lead ON public.whatsapp_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_phone_norm ON public.whatsapp_messages(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_wa_msg_unidade ON public.whatsapp_messages(unidade_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_direction ON public.whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_wa_msg_received_at ON public.whatsapp_messages(received_at);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

-- RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage whatsapp_conversations" ON public.whatsapp_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage whatsapp_messages" ON public.whatsapp_messages FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at on conversations
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_conversations_updated_at
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();