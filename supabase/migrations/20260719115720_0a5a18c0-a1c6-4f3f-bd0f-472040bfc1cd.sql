
-- Admin RPCs to manage pg_cron jobs from the app
CREATE OR REPLACE FUNCTION public.admin_list_cron_jobs()
RETURNS TABLE(jobid bigint, jobname text, schedule text, active boolean, command text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  RETURN QUERY
    SELECT j.jobid, j.jobname, j.schedule, j.active, j.command
    FROM cron.job j
    ORDER BY j.jobname;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_cron_job(p_jobid bigint, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  PERFORM cron.alter_job(job_id := p_jobid, active := p_active);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_cron_schedule(p_jobid bigint, p_schedule text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  -- Basic cron format validation: 5 fields
  IF array_length(regexp_split_to_array(btrim(p_schedule), '\s+'), 1) <> 5 THEN
    RAISE EXCEPTION 'Formato de cron inválido (esperado: 5 campos)';
  END IF;
  PERFORM cron.alter_job(job_id := p_jobid, schedule := p_schedule);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_cron_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_cron_job(bigint, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_cron_schedule(bigint, text) TO authenticated;
