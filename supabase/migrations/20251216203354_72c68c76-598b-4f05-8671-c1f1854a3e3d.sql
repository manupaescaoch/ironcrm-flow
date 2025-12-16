-- Backfill NULL created_by values in leads table
-- Use user_id if available, otherwise use first admin user
UPDATE public.leads 
SET created_by = COALESCE(
  user_id, 
  (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1)
)
WHERE created_by IS NULL;

-- Backfill NULL created_by values in interacoes table
UPDATE public.interacoes 
SET created_by = COALESCE(
  created_by,
  (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1)
)
WHERE created_by IS NULL;

-- Set default value for created_by in leads table
ALTER TABLE public.leads 
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Set default value for created_by in interacoes table (already has default, but ensure it's set)
ALTER TABLE public.interacoes 
ALTER COLUMN created_by SET DEFAULT auth.uid();