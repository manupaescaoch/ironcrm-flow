
ALTER TABLE public.whatsapp_conversations
  ALTER COLUMN unidade_id SET NOT NULL;

DROP POLICY IF EXISTS select_whatsapp_conversations_by_unidade ON public.whatsapp_conversations;

CREATE POLICY select_whatsapp_conversations_by_unidade
ON public.whatsapp_conversations
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND unidade_id IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);
