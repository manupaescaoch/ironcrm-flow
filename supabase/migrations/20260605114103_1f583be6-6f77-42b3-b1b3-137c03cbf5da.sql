-- 1. Helper function for cron secrets
CREATE OR REPLACE FUNCTION public.get_cron_secret()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Returns the secure secret shared between pg_cron and Edge Functions
  RETURN 'manupaes.coach@gmail.com';
END;
$function$;

-- 2. Management Report (Daily 08:00 BRT = 11:00 UTC)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-resumo-gestao-operacional') THEN
        PERFORM cron.unschedule('notify-resumo-gestao-operacional');
    END IF;
END $$;

SELECT cron.schedule(
    'notify-resumo-gestao-operacional',
    '0 11 * * *',
    $$
    SELECT net.http_post(
        url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/notify-resumo-gestao-operacional',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', public.get_cron_secret()
        ),
        body := '{}'::jsonb
    ) AS request_id;
    $$
);

-- 3. CRM Backup (Daily 02:00 BRT = 05:00 UTC)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-crm-backup-secured') THEN
        PERFORM cron.unschedule('daily-crm-backup-secured');
    END IF;
END $$;

SELECT cron.schedule(
    'daily-crm-backup-secured',
    '0 5 * * *',
    $$
    SELECT net.http_post(
        url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/daily-crm-backup',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', public.get_cron_secret()
        ),
        body := '{"triggered_by": "cron", "scheduled": true}'::jsonb
    ) AS request_id;
    $$
);
