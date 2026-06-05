-- 1. Remover função de teste manual
DROP FUNCTION IF EXISTS public.notify_rotinas_diarias_manual();

-- 2. Garantir que o cron job esteja configurado corretamente (unificando os passos anteriores)
SELECT cron.unschedule('notify-rotinas-every-15min');

SELECT cron.schedule(
  'notify-rotinas-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/notify-rotinas-diarias',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.get_cron_secret()
    ),
    body := jsonb_build_object('time', now())
  ) AS request_id;
  $$
);
