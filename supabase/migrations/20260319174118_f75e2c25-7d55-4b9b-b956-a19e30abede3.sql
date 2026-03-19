
-- 1. Corrigir trigger para incluir unidade_id
CREATE OR REPLACE FUNCTION public.atualizar_estoque_apos_movimentacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verifica se já existe registro de estoque para o insumo NA MESMA UNIDADE
  IF NOT EXISTS (SELECT 1 FROM public.estoque_interno WHERE insumo_id = NEW.insumo_id AND unidade_id = NEW.unidade_id) THEN
    INSERT INTO public.estoque_interno (insumo_id, quantidade_atual, unidade_id) VALUES (NEW.insumo_id, 0, NEW.unidade_id);
  END IF;

  -- Atualiza quantidade baseado no tipo (filtrando por unidade_id)
  IF NEW.tipo = 'entrada' THEN
    UPDATE public.estoque_interno SET quantidade_atual = quantidade_atual + NEW.quantidade, updated_at = now() WHERE insumo_id = NEW.insumo_id AND unidade_id = NEW.unidade_id;
  ELSIF NEW.tipo = 'retirada' THEN
    UPDATE public.estoque_interno SET quantidade_atual = GREATEST(0, quantidade_atual - NEW.quantidade), updated_at = now() WHERE insumo_id = NEW.insumo_id AND unidade_id = NEW.unidade_id;
  ELSIF NEW.tipo = 'ajuste' THEN
    UPDATE public.estoque_interno SET quantidade_atual = NEW.quantidade, updated_at = now() WHERE insumo_id = NEW.insumo_id AND unidade_id = NEW.unidade_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Corrigir dados existentes: ajustar unidade_id do estoque_interno para bater com o insumo
UPDATE estoque_interno ei
SET unidade_id = i.unidade_id
FROM insumos i
WHERE ei.insumo_id = i.id
  AND ei.unidade_id IS DISTINCT FROM i.unidade_id
  AND i.unidade_id IS NOT NULL;
