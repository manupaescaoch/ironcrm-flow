-- Remover interações duplicadas de matrícula, mantendo apenas a mais antiga de cada lead
WITH duplicadas AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY created_at ASC) as rn
  FROM interacoes
  WHERE fechou_matricula = true
)
DELETE FROM interacoes
WHERE id IN (
  SELECT id FROM duplicadas WHERE rn > 1
);

-- Criar função para prevenir duplicatas futuras
CREATE OR REPLACE FUNCTION check_duplicate_matricula()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fechou_matricula = true THEN
    IF EXISTS (
      SELECT 1 FROM interacoes 
      WHERE lead_id = NEW.lead_id 
        AND fechou_matricula = true 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Este lead já possui uma matrícula registrada';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para prevenir duplicatas
CREATE TRIGGER prevent_duplicate_matricula
  BEFORE INSERT OR UPDATE ON interacoes
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_matricula();