-- Remove the existing check constraint and add a new one that includes D+1
ALTER TABLE follow_ups DROP CONSTRAINT IF EXISTS follow_ups_tipo_check;

-- Add new check constraint that includes D+1
ALTER TABLE follow_ups ADD CONSTRAINT follow_ups_tipo_check 
  CHECK (tipo IN ('D+1', 'D+7', 'D+15', 'D+30'));