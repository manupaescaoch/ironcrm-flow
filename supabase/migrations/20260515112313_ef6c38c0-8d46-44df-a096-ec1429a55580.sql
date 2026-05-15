
-- relatorio_diario_comercial_respostas
DROP POLICY IF EXISTS "Anyone can submit relatorio diario" ON public.relatorio_diario_comercial_respostas;

CREATE POLICY "insert_relatorio_diario_authenticated"
ON public.relatorio_diario_comercial_respostas
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND nome IS NOT NULL AND char_length(trim(nome)) BETWEEN 1 AND 200
  AND unidade IS NOT NULL AND char_length(trim(unidade)) BETWEEN 1 AND 100
  AND data IS NOT NULL
);

-- task_notifications
-- Triggers SECURITY DEFINER (notify_task_assignment) bypassam RLS, então criação automática
-- continua funcionando. Cliente comum não pode mais inserir notificações arbitrárias.
DROP POLICY IF EXISTS "System can insert notifications" ON public.task_notifications;

CREATE POLICY "insert_task_notifications_admin_only"
ON public.task_notifications
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
