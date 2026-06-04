-- 1. whatsapp_conversations: Limpeza e RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read whatsapp_conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Authenticated users can select conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Permitir inserção/atualização para usuários autenticados" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Permitir leitura para usuários autenticados" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Users can manage whatsapp_conversations" ON public.whatsapp_conversations;

-- SELECT
CREATE POLICY "select_whatsapp_conversations_by_unidade"
ON public.whatsapp_conversations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (unidade_id IS NOT NULL AND unidade_id IN (SELECT public.get_user_unidades(auth.uid())))
);

-- INSERT
CREATE POLICY "insert_whatsapp_conversations_by_unidade"
ON public.whatsapp_conversations
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (unidade_id IS NOT NULL AND unidade_id IN (SELECT public.get_user_unidades(auth.uid())))
);

-- UPDATE
CREATE POLICY "update_whatsapp_conversations_by_unidade"
ON public.whatsapp_conversations
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (unidade_id IS NOT NULL AND unidade_id IN (SELECT public.get_user_unidades(auth.uid())))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (unidade_id IS NOT NULL AND unidade_id IN (SELECT public.get_user_unidades(auth.uid())))
);

-- DELETE
CREATE POLICY "delete_whatsapp_conversations_admin_only"
ON public.whatsapp_conversations
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);


-- 2. whatsapp_messages: Limpeza e RLS (utilizando unidade_id direto presente na tabela)
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can select messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Permitir leitura para usuários autenticados" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can manage whatsapp_messages" ON public.whatsapp_messages;

-- SELECT
CREATE POLICY "select_whatsapp_messages_by_unidade"
ON public.whatsapp_messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (unidade_id IS NOT NULL AND unidade_id IN (SELECT public.get_user_unidades(auth.uid())))
);

-- INSERT
CREATE POLICY "insert_whatsapp_messages_by_unidade"
ON public.whatsapp_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (unidade_id IS NOT NULL AND unidade_id IN (SELECT public.get_user_unidades(auth.uid())))
);

-- UPDATE (se necessário)
CREATE POLICY "update_whatsapp_messages_by_unidade"
ON public.whatsapp_messages
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (unidade_id IS NOT NULL AND unidade_id IN (SELECT public.get_user_unidades(auth.uid())))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (unidade_id IS NOT NULL AND unidade_id IN (SELECT public.get_user_unidades(auth.uid())))
);

-- DELETE
CREATE POLICY "delete_whatsapp_messages_admin_only"
ON public.whatsapp_messages
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);