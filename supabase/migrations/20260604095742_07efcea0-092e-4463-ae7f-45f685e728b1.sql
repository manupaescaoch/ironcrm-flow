-- Adjust whatsapp_conversations table
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS phone_normalized TEXT,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS last_message_text TEXT,
ADD COLUMN IF NOT EXISTS last_message_direction TEXT CHECK (last_message_direction IN ('inbound', 'outbound')),
ADD COLUMN IF NOT EXISTS is_linked_to_lead BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_cliente BOOLEAN DEFAULT false;

-- Add index for phone_normalized
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone_normalized ON public.whatsapp_conversations (phone_normalized);

-- Adjust whatsapp_messages table
ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS phone_normalized TEXT,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS message_text TEXT,
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- Create or update updated_at trigger for conversations
CREATE OR REPLACE FUNCTION public.update_whatsapp_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_whatsapp_conversations_updated_at ON public.whatsapp_conversations;
CREATE TRIGGER tr_update_whatsapp_conversations_updated_at
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_whatsapp_conversations_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO service_role;

-- Enable Realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
