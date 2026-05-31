-- SECURITY: shared cron secret stored in vault, read by both pg_cron jobs and edge functions.

-- Create RPC for edge functions to fetch the cron secret via service_role.
CREATE OR REPLACE FUNCTION public.get_cron_secret()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1
$$;

-- Lock down: only service_role can call (edge functions use service_role).
REVOKE ALL ON FUNCTION public.get_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_secret() TO service_role;