
ALTER TABLE public.whatsapp_messages
  ALTER COLUMN unidade_id SET NOT NULL;

DROP POLICY IF EXISTS select_whatsapp_messages_by_unidade ON public.whatsapp_messages;
CREATE POLICY select_whatsapp_messages_by_unidade
ON public.whatsapp_messages
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

DROP POLICY IF EXISTS update_whatsapp_messages_by_unidade ON public.whatsapp_messages;
CREATE POLICY update_whatsapp_messages_by_unidade
ON public.whatsapp_messages
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND unidade_id IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND unidade_id IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

DROP POLICY IF EXISTS insert_whatsapp_messages_by_unidade ON public.whatsapp_messages;
CREATE POLICY insert_whatsapp_messages_by_unidade
ON public.whatsapp_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND unidade_id IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);
