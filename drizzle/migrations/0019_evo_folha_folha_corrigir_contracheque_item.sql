ALTER TABLE public.folha_contracheque_itens
  ADD COLUMN IF NOT EXISTS liquido_original numeric(12,2),
  ADD COLUMN IF NOT EXISTS motivo_correcao text,
  ADD COLUMN IF NOT EXISTS corrigido_por uuid,
  ADD COLUMN IF NOT EXISTS corrigido_em timestamptz;

-- Correção auditável de um item revisado: só em competência aberta, motivo obrigatório; substitui o valor (nunca soma).
CREATE OR REPLACE FUNCTION public.folha_corrigir_contracheque_item(p_item uuid, p_usuario uuid, p_liquido numeric, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE i record; anterior numeric;
BEGIN
  PERFORM set_config('folha.usuario', p_usuario::text, true);
  SELECT * INTO i FROM public.folha_contracheque_itens WHERE id=p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('folha:' || i.unidade_id::text || ':' || i.competencia));
  IF NOT i.ativo THEN RAISE EXCEPTION 'Item de importação apagada não pode ser corrigido'; END IF;
  IF EXISTS (SELECT 1 FROM public.folha_competencias WHERE unidade_id=i.unidade_id AND competencia=i.competencia AND status='fechada') THEN
    RAISE EXCEPTION 'Competência fechada: correção recusada';
  END IF;
  IF EXISTS (SELECT 1 FROM public.folha_pagamentos WHERE colaborador_id=i.colaborador_id AND competencia=i.competencia AND status='pago') THEN
    RAISE EXCEPTION 'Pagamento já confirmado: correção recusada';
  END IF;
  IF p_liquido IS NULL OR p_liquido < 0 OR p_liquido > 1000000 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF length(trim(COALESCE(p_motivo,''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo da correção'; END IF;
  anterior := i.liquido;
  PERFORM set_config('folha.importacao', '1', true);
  UPDATE public.folha_contracheque_itens SET liquido=p_liquido, liquido_original=COALESCE(liquido_original, anterior),
    motivo_correcao=left(trim(p_motivo),300), corrigido_por=p_usuario, corrigido_em=now() WHERE id=p_item;
  UPDATE public.folha_lancamentos SET liquido_importado=p_liquido, updated_by=p_usuario WHERE colaborador_id=i.colaborador_id AND competencia=i.competencia;
  UPDATE public.folha_contracheques SET total_liquido=(SELECT COALESCE(sum(liquido),0) FROM public.folha_contracheque_itens WHERE contracheque_id=i.contracheque_id AND ativo) WHERE id=i.contracheque_id;
  RETURN jsonb_build_object('ok', true, 'anterior', anterior, 'novo', p_liquido);
END $$;
REVOKE ALL ON FUNCTION public.folha_corrigir_contracheque_item(uuid,uuid,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.folha_corrigir_contracheque_item(uuid,uuid,numeric,text) TO service_role;