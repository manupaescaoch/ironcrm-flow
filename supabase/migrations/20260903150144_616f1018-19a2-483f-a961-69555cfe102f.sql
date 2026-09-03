CREATE OR REPLACE FUNCTION public.notify_ops_push_http()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/ops-push-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.get_cron_secret()
    ),
    body := jsonb_build_object(
      'usuario_id', NEW.usuario_id,
      'titulo', NEW.titulo,
      'mensagem', COALESCE(NEW.mensagem, ''),
      'url', '/ops/alertas',
      'tag', NEW.id::text
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_ops_push_http() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_notify_ops_push ON public.ops_notificacoes;
CREATE TRIGGER trg_notify_ops_push
AFTER INSERT ON public.ops_notificacoes
FOR EACH ROW
EXECUTE FUNCTION public.notify_ops_push_http();