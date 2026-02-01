-- Create tasks table for task management
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  responsavel text NOT NULL,
  setor text NOT NULL,
  prioridade text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'a_fazer',
  prazo date,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
-- SELECT: Authenticated user + (admin OR unidade permitida)
CREATE POLICY "select_tasks_by_unidade" ON public.tasks
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      unidade_id IN (SELECT get_user_unidades(auth.uid()))
    )
  );

-- INSERT: Authenticated user + (admin OR unidade permitida)
CREATE POLICY "insert_tasks_by_unidade" ON public.tasks
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      unidade_id IN (SELECT get_user_unidades(auth.uid()))
    )
  );

-- UPDATE: Authenticated user + (admin OR unidade permitida)
CREATE POLICY "update_tasks_by_unidade" ON public.tasks
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      unidade_id IN (SELECT get_user_unidades(auth.uid()))
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      unidade_id IN (SELECT get_user_unidades(auth.uid()))
    )
  );

-- DELETE: Only admin
CREATE POLICY "delete_tasks_admin_only" ON public.tasks
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;