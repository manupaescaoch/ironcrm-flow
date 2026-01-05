-- Parte 1: Corrigir dados existentes - leads com matrícula fechada mas status incorreto
UPDATE leads
SET status_funil = 'convertido', updated_at = now()
WHERE id IN (
  SELECT DISTINCT l.id
  FROM leads l
  INNER JOIN interacoes i ON i.lead_id = l.id
  WHERE i.fechou_matricula = true
    AND l.status_funil NOT IN ('convertido', 'perdido')
);

-- Parte 2: Criar função trigger para futuras matrículas
CREATE OR REPLACE FUNCTION update_lead_status_on_matricula()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fechou_matricula = true THEN
    UPDATE leads
    SET status_funil = 'convertido', updated_at = now()
    WHERE id = NEW.lead_id
      AND status_funil NOT IN ('convertido', 'perdido');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Parte 3: Criar trigger que executa após INSERT ou UPDATE em interacoes
DROP TRIGGER IF EXISTS trigger_update_lead_on_matricula ON interacoes;
CREATE TRIGGER trigger_update_lead_on_matricula
AFTER INSERT OR UPDATE OF fechou_matricula ON interacoes
FOR EACH ROW
EXECUTE FUNCTION update_lead_status_on_matricula();