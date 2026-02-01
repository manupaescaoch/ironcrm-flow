-- Tabela de notificações de tarefas
CREATE TABLE public.task_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'nova_tarefa',
  titulo text NOT NULL,
  mensagem text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;

-- Usuário só vê suas próprias notificações
CREATE POLICY "Users can view own notifications"
ON public.task_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Usuário pode atualizar suas próprias notificações (marcar como lida)
CREATE POLICY "Users can update own notifications"
ON public.task_notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Política para permitir INSERT do trigger (SECURITY DEFINER)
CREATE POLICY "System can insert notifications"
ON public.task_notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Índice para performance
CREATE INDEX idx_task_notifications_user ON public.task_notifications(user_id, lida);
CREATE INDEX idx_task_notifications_created ON public.task_notifications(created_at DESC);

-- Função para encontrar usuário pelo nome (compara com raw_user_meta_data->>'name')
CREATE OR REPLACE FUNCTION public.find_user_by_name(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users
  WHERE UPPER(COALESCE(raw_user_meta_data->>'name', '')) = UPPER(TRIM(p_name))
  LIMIT 1
$$;

-- Função trigger para criar notificação quando tarefa é atribuída
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_creator_name text;
BEGIN
  -- Encontrar usuário pelo nome do responsável
  v_user_id := public.find_user_by_name(NEW.responsavel);
  
  -- Se encontrou usuário e não é o próprio criador
  IF v_user_id IS NOT NULL AND v_user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    -- Buscar nome do criador
    SELECT COALESCE(raw_user_meta_data->>'name', email) INTO v_creator_name
    FROM auth.users WHERE id = NEW.created_by;
    
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.task_notifications (task_id, user_id, tipo, titulo, mensagem)
      VALUES (
        NEW.id,
        v_user_id,
        'nova_tarefa',
        'Nova tarefa atribuída',
        'Você foi designado para: ' || NEW.titulo || ' por ' || COALESCE(v_creator_name, 'Sistema')
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.responsavel IS DISTINCT FROM NEW.responsavel THEN
      INSERT INTO public.task_notifications (task_id, user_id, tipo, titulo, mensagem)
      VALUES (
        NEW.id,
        v_user_id,
        'tarefa_atualizada',
        'Tarefa transferida para você',
        'A tarefa "' || NEW.titulo || '" foi transferida para você'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
CREATE TRIGGER trigger_notify_task_assignment
AFTER INSERT OR UPDATE OF responsavel ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assignment();

-- Habilitar realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_notifications;