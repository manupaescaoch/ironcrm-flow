select net.http_post(
  url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/send-cronograma-messages',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', public.get_cron_secret()),
  body := jsonb_build_object('force_hour', 11, 'force_minute', 0)
);