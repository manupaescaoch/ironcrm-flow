
-- 1. Criar o trigger que falta
CREATE TRIGGER trigger_atualizar_estoque
AFTER INSERT ON public.movimentacoes_estoque
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_estoque_apos_movimentacao();

-- 2. Recalcular TODOS os saldos de estoque baseado no histórico
-- Para cada insumo: encontrar último ajuste, somar entradas e subtrair retiradas após ele
WITH ultimo_ajuste AS (
  SELECT DISTINCT ON (insumo_id)
    insumo_id, quantidade, created_at
  FROM movimentacoes_estoque
  WHERE tipo = 'ajuste'
  ORDER BY insumo_id, created_at DESC
),
saldos AS (
  SELECT 
    e.insumo_id,
    COALESCE(ua.quantidade, 0) +
    COALESCE((
      SELECT SUM(m.quantidade) FROM movimentacoes_estoque m 
      WHERE m.insumo_id = e.insumo_id AND m.tipo = 'entrada'
      AND (ua.created_at IS NULL OR m.created_at > ua.created_at)
    ), 0) -
    COALESCE((
      SELECT SUM(m.quantidade) FROM movimentacoes_estoque m 
      WHERE m.insumo_id = e.insumo_id AND m.tipo = 'retirada'
      AND (ua.created_at IS NULL OR m.created_at > ua.created_at)
    ), 0) AS saldo_calculado
  FROM estoque_interno e
  LEFT JOIN ultimo_ajuste ua ON ua.insumo_id = e.insumo_id
)
UPDATE estoque_interno ei
SET quantidade_atual = GREATEST(0, s.saldo_calculado), updated_at = now()
FROM saldos s
WHERE ei.insumo_id = s.insumo_id;
