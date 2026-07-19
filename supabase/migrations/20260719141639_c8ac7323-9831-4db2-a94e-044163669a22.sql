ALTER TABLE public.anamneses_experimental ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- Grant implicit (column-level inherits table grants, no new table created)