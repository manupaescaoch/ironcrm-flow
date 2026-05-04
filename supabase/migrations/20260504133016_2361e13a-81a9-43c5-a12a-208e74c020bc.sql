DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'resumo-trafego-semanal-segunda-10h';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'resumo-trafego-semanal-segunda-10h',
  '0 13 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/notify-resumo-trafego-semanal',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzcGNkdnRkZ3NzYWJwcXJ5YmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNzk3OTgsImV4cCI6MjA4MDk1NTc5OH0.oegy8-SggH6t1mPHd0NDOG5wK8goM7ijkL_OhEH3jP8"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);