-- Tornar setor opcional (nullable com default vazio)
ALTER TABLE public.tasks ALTER COLUMN setor DROP NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN setor SET DEFAULT '';

-- Adicionar hora do prazo
ALTER TABLE public.tasks ADD COLUMN hora_prazo TIME;

-- Controle de notificações enviadas
ALTER TABLE public.tasks ADD COLUMN notificado_24h BOOLEAN DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN notificado_prazo BOOLEAN DEFAULT false;

-- Resetar flags quando prazo é alterado
CREATE OR REPLACE FUNCTION public.reset_task_notification_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se prazo ou hora_prazo mudou, resetar flags de notificação
  IF (OLD.prazo IS DISTINCT FROM NEW.prazo) OR (OLD.hora_prazo IS DISTINCT FROM NEW.hora_prazo) THEN
    NEW.notificado_24h := false;
    NEW.notificado_prazo := false;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para resetar flags
DROP TRIGGER IF EXISTS reset_notification_flags_on_prazo_change ON public.tasks;
CREATE TRIGGER reset_notification_flags_on_prazo_change
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_task_notification_flags();