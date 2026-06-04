-- Check if tables exist and RLS is enabled
DO $$ 
BEGIN
    -- For whatsapp_conversations
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_conversations') THEN
        ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
        
        -- Drop if already exists to avoid conflict
        DROP POLICY IF EXISTS "Authenticated users can select conversations" ON public.whatsapp_conversations;
        
        CREATE POLICY "Authenticated users can select conversations" 
        ON public.whatsapp_conversations 
        FOR SELECT 
        TO authenticated 
        USING (true);

        -- Ensure GRANTs
        GRANT SELECT ON public.whatsapp_conversations TO authenticated;
        GRANT ALL ON public.whatsapp_conversations TO service_role;
    END IF;

    -- For whatsapp_messages
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_messages') THEN
        ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
        
        -- Drop if already exists to avoid conflict
        DROP POLICY IF EXISTS "Authenticated users can select messages" ON public.whatsapp_messages;
        
        CREATE POLICY "Authenticated users can select messages" 
        ON public.whatsapp_messages 
        FOR SELECT 
        TO authenticated 
        USING (true);

        -- Ensure GRANTs
        GRANT SELECT ON public.whatsapp_messages TO authenticated;
        GRANT ALL ON public.whatsapp_messages TO service_role;
    END IF;
END $$;
