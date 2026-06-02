-- notify_task_assignment is not attached to any trigger (verified via pg_trigger).
-- find_user_by_name is only referenced by that orphan function and has no callers
-- in app code or other DB routines. Both resolve identity by display name, which
-- is unsafe (no unidade scoping, homonym spoofing). Drop to remove latent risk.

DROP FUNCTION IF EXISTS public.notify_task_assignment() CASCADE;
DROP FUNCTION IF EXISTS public.find_user_by_name(text) CASCADE;