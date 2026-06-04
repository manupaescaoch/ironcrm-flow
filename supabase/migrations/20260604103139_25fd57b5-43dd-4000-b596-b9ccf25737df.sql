-- 1. Garantir RLS ativa
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas antigas/amplas conhecidas ou possíveis
DROP POLICY IF EXISTS "Users can manage whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated can view whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated can insert whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "select_whatsapp_messages_all" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "insert_whatsapp_messages_all" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "whatsapp_messages_select_true" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "whatsapp_messages_insert_true" ON public.whatsapp_messages;

-- Remover também as que listamos no audit para garantir recriação limpa
DROP POLICY IF EXISTS "select_whatsapp_messages_by_unidade" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "insert_whatsapp_messages_by_unidade" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "update_whatsapp_messages_by_unidade" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "delete_whatsapp_messages_admin_only" ON public.whatsapp_messages;

-- 3. Criar políticas escopadas por unidade

-- SELECT: Admin ou usuários com acesso à unidade_id
CREATE POLICY "select_whatsapp_messages_by_unidade"
ON public.whatsapp_messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (unidade_id IS NOT NULL AND unidade_id IN (SELECT public.get_user_unidades(auth.uid())))
);

-- INSERT: Admin ou usuários inserindo mensagens na sua unidade
CREATE POLICY "insert_whatsapp_messages_by_unidade"
ON public.whatsapp_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (unidade_id IS NOT NULL AND unidade_id IN (SELECT public.get_user_unidades(auth.uid())))
);

-- UPDATE: Admin ou usuários atualizando mensagens da sua unidade
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

-- DELETE: Apenas administradores
CREATE POLICY "delete_whatsapp_messages_admin_only"
ON public.whatsapp_messages
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

-- 4. Ajustar permissões de acesso ao objeto (GRANTs)
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
-- Anon explicitamente bloqueado
REVOKE ALL ON public.whatsapp_messages FROM anon;