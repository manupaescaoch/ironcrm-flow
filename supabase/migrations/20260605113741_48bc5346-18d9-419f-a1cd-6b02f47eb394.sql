-- Remove o job antigo se existir
SELECT cron.unschedule('gestao-operacional-manu-diario-0805');

-- Adiciona o novo job para o Resumo Gestão Operacional
SELECT cron.schedule(
    'resumo-gestao-operacional-diario-0800',
    '0 11 * * *',
    $$
    SELECT net.http_post(
        url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/notify-resumo-gestao-operacional',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', public.get_cron_secret()
        ),
        body := '{}'::jsonb
    );
    $$
);
