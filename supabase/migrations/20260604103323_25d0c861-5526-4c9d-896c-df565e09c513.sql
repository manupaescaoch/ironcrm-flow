-- Garantir RLS ativa
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- 1. Limpeza de políticas antigas ou inseguras (conforme auditoria e histórico)
DROP POLICY IF EXISTS "Users can manage whatsapp_conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "insert_whatsapp_conversations_by_unidade" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "update_whatsapp_conversations_by_unidade" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "delete_whatsapp_conversations_admin_only" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "select_whatsapp_conversations_by_unidade" ON public.whatsapp_conversations;

-- 2. Política de SELECT (Leitura escopada por unidade)
CREATE POLICY "select_whatsapp_conversations_by_unidade"
ON public.whatsapp_conversations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    unidade_id IS NOT NULL 
    AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

-- 3. Política de INSERT (Escopada por unidade e validação de lead)
CREATE POLICY "insert_whatsapp_conversations_by_unidade"
ON public.whatsapp_conversations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      unidade_id IS NOT NULL 
      AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
      AND (
        lead_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.leads l
          WHERE l.id = whatsapp_conversations.lead_id
            AND l.unidade_id = whatsapp_conversations.unidade_id
        )
      )
    )
  )
);

-- 4. Política de UPDATE (Escopada por unidade e impedindo troca indevida)
CREATE POLICY "update_whatsapp_conversations_by_unidade"
ON public.whatsapp_conversations
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      unidade_id IS NOT NULL 
      AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      unidade_id IS NOT NULL 
      AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
      AND (
        lead_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.leads l
          WHERE l.id = whatsapp_conversations.lead_id
            AND l.unidade_id = whatsapp_conversations.unidade_id
        )
      )
    )
  )
);

-- 5. Política de DELETE (Apenas Admin)
CREATE POLICY "delete_whatsapp_conversations_admin_only"
ON public.whatsapp_conversations
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.has_role(auth.uid(), 'admin')
);

-- 6. Garantir permissões de tabela para as roles corretas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
REVOKE ALL ON public.whatsapp_conversations FROM anon;
REVOKE ALL ON public.whatsapp_conversations FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
