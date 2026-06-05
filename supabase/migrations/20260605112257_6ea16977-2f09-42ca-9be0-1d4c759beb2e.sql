CREATE OR REPLACE FUNCTION public.notify_rotinas_diarias_manual()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret text;
  v_response_id int;
BEGIN
  v_secret := public.get_cron_secret();
  
  SELECT net.http_post(
    url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/notify-rotinas-diarias',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := jsonb_build_object('time', now(), 'manual_trigger', true)
  ) INTO v_response_id;

  RETURN jsonb_build_object('request_id', v_response_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.notify_rotinas_diarias_manual() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_rotinas_diarias_manual() TO authenticated;
