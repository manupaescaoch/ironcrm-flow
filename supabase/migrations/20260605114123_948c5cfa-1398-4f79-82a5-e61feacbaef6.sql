-- 1. Redefine get_cron_secret with proper permissions
CREATE OR REPLACE FUNCTION public.get_cron_secret()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN 'manupaes.coach@gmail.com';
END;
$function$;

REVOKE ALL ON FUNCTION public.get_cron_secret() FROM public;
GRANT EXECUTE ON FUNCTION public.get_cron_secret() TO service_role, postgres;

-- 2. Update notify-task-deadlines
DO $$ BEGIN IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-task-deadlines') THEN PERFORM cron.unschedule('notify-task-deadlines'); END IF; END $$;
SELECT cron.schedule('notify-task-deadlines', '*/15 * * * *', $$
    SELECT net.http_post(
        url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/notify-task-deadlines',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', public.get_cron_secret()),
        body := '{}'::jsonb
    ) AS request_id;
$$);

-- 3. Update notify-feedback-experimental-30min
DO $$ BEGIN IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-feedback-experimental-30min') THEN PERFORM cron.unschedule('notify-feedback-experimental-30min'); END IF; END $$;
SELECT cron.schedule('notify-feedback-experimental-30min', '*/30 * * * *', $$
    SELECT net.http_post(
        url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/notify-feedback-experimental',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', public.get_cron_secret()),
        body := '{}'::jsonb
    ) AS request_id;
$$);

-- 4. Update notify-boas-vindas-matricula-every-30min
DO $$ BEGIN IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-boas-vindas-matricula-every-30min') THEN PERFORM cron.unschedule('notify-boas-vindas-matricula-every-30min'); END IF; END $$;
SELECT cron.schedule('notify-boas-vindas-matricula-every-30min', '*/30 * * * *', $$
    SELECT net.http_post(
        url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/notify-boas-vindas-matricula',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', public.get_cron_secret()),
        body := jsonb_build_object('time', now())
    ) AS request_id;
$$);

-- 5. Update send-cronograma-messages-every-3min
DO $$ BEGIN IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-cronograma-messages-every-3min') THEN PERFORM cron.unschedule('send-cronograma-messages-every-3min'); END IF; END $$;
SELECT cron.schedule('send-cronograma-messages-every-3min', '*/3 * * * *', $$
    SELECT net.http_post(
        url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/send-cronograma-messages',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', public.get_cron_secret()),
        body := jsonb_build_object('time', now())
    ) AS request_id;
$$);

-- 6. Update send-follow-ups-automaticos-daily
DO $$ BEGIN IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-follow-ups-automaticos-daily') THEN PERFORM cron.unschedule('send-follow-ups-automaticos-daily'); END IF; END $$;
SELECT cron.schedule('send-follow-ups-automaticos-daily', '0 12 * * 1-5', $$
    SELECT net.http_post(
        url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/send-follow-ups-automaticos',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', public.get_cron_secret()),
        body := jsonb_build_object('triggered_at', now())
    ) AS request_id;
$$);
