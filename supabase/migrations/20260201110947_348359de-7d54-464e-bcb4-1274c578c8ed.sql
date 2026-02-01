-- =============================================
-- FASE 1: Novas Tabelas e Campos para Tarefas
-- =============================================

-- 1.1 Tabela de Comentários
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.2 Tabela de Subtarefas/Checklist
CREATE TABLE public.task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.3 Tabela de Histórico/Auditoria
CREATE TABLE public.task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text NOT NULL,
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.4 Novos campos na tabela tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS concluida_em timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recorrencia text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recorrencia_fim date;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_id ON public.task_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON public.task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_arquivada ON public.tasks(arquivada);

-- =============================================
-- RLS Policies para task_comments
-- =============================================
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_task_comments_by_task_unidade"
ON public.task_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR t.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
);

CREATE POLICY "insert_task_comments_by_task_unidade"
ON public.task_comments FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR t.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
);

CREATE POLICY "delete_task_comments_own_or_admin"
ON public.task_comments FOR DELETE
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- =============================================
-- RLS Policies para task_subtasks
-- =============================================
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_task_subtasks_by_task_unidade"
ON public.task_subtasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_subtasks.task_id
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR t.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
);

CREATE POLICY "insert_task_subtasks_by_task_unidade"
ON public.task_subtasks FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_subtasks.task_id
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR t.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
);

CREATE POLICY "update_task_subtasks_by_task_unidade"
ON public.task_subtasks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_subtasks.task_id
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR t.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
);

CREATE POLICY "delete_task_subtasks_by_task_unidade"
ON public.task_subtasks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_subtasks.task_id
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR t.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
);

-- =============================================
-- RLS Policies para task_history
-- =============================================
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_task_history_by_task_unidade"
ON public.task_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_history.task_id
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR t.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
  )
);

CREATE POLICY "insert_task_history_system"
ON public.task_history FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- Trigger de Auditoria
-- =============================================
CREATE OR REPLACE FUNCTION public.log_task_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name text;
BEGIN
  -- Tentar obter nome do usuário
  v_user_name := COALESCE(
    (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = auth.uid()),
    'SISTEMA'
  );

  -- Log mudança de status
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_history (task_id, user_id, user_name, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, auth.uid(), v_user_name, 'status', OLD.status, NEW.status);
    
    -- Se mudou para concluída, registrar data
    IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
      NEW.concluida_em := now();
    END IF;
  END IF;

  -- Log mudança de prioridade
  IF OLD.prioridade IS DISTINCT FROM NEW.prioridade THEN
    INSERT INTO task_history (task_id, user_id, user_name, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, auth.uid(), v_user_name, 'prioridade', OLD.prioridade, NEW.prioridade);
  END IF;

  -- Log mudança de responsável
  IF OLD.responsavel IS DISTINCT FROM NEW.responsavel THEN
    INSERT INTO task_history (task_id, user_id, user_name, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, auth.uid(), v_user_name, 'responsavel', OLD.responsavel, NEW.responsavel);
  END IF;

  -- Log mudança de prazo
  IF OLD.prazo IS DISTINCT FROM NEW.prazo THEN
    INSERT INTO task_history (task_id, user_id, user_name, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, auth.uid(), v_user_name, 'prazo', OLD.prazo::text, NEW.prazo::text);
  END IF;

  -- Log mudança de título
  IF OLD.titulo IS DISTINCT FROM NEW.titulo THEN
    INSERT INTO task_history (task_id, user_id, user_name, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, auth.uid(), v_user_name, 'titulo', OLD.titulo, NEW.titulo);
  END IF;

  -- Log mudança de setor
  IF OLD.setor IS DISTINCT FROM NEW.setor THEN
    INSERT INTO task_history (task_id, user_id, user_name, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, auth.uid(), v_user_name, 'setor', OLD.setor, NEW.setor);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_audit_trigger
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_task_changes();

-- =============================================
-- Habilitar Realtime
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_subtasks