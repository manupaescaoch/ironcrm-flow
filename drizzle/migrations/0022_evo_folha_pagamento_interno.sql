-- Confirmação de pagamento como CONTROLE INTERNO da folha.
-- Não toca contas_pagar, fluxo de caixa, conciliação nem qualquer outro módulo.
ALTER TABLE public.folha_pagamentos ADD COLUMN IF NOT EXISTS motivo_desfazer text;

CREATE OR REPLACE FUNCTION public.folha_registrar_pagamento_interno(p_pagamento uuid, p_usuario uuid, p_acao text, p_valor numeric, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE g record; k record;
BEGIN
  IF p_acao NOT IN ('confirmar','desfazer') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
  SELECT * INTO g FROM public.folha_pagamentos WHERE id=p_pagamento;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento não encontrado'; END IF;
  IF NOT public.folha_pode(p_usuario,g.unidade_id,'ver') OR NOT public.folha_pode(p_usuario,g.unidade_id,p_acao) THEN
    RAISE EXCEPTION 'Sem permissão para esta ação na folha';
  END IF;
  IF p_acao='desfazer' AND length(trim(COALESCE(p_motivo,'')))<5 THEN
    RAISE EXCEPTION 'Informe o motivo para desfazer (mínimo 5 caracteres)';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('folha:'||g.unidade_id::text||':'||g.competencia));
  SELECT * INTO k FROM public.folha_competencias WHERE unidade_id=g.unidade_id AND competencia=g.competencia FOR UPDATE;
  IF k.status IS DISTINCT FROM 'fechada' THEN RAISE EXCEPTION 'Competência não está fechada'; END IF;
  SELECT * INTO g FROM public.folha_pagamentos WHERE id=p_pagamento FOR UPDATE;
  PERFORM set_config('folha.usuario', p_usuario::text, true);
  IF p_acao='confirmar' THEN
    IF g.status='pago' THEN RETURN jsonb_build_object('ok',true,'ja_pago',true,'valor',g.valor_confirmado); END IF;
    IF p_valor IS DISTINCT FROM g.valor THEN RAISE EXCEPTION 'Valor recalculado diverge do retrato fechado'; END IF;
    UPDATE public.folha_pagamentos SET status='pago', valor_confirmado=p_valor, confirmado_por=p_usuario, motivo_desfazer=NULL WHERE id=g.id;
    RETURN jsonb_build_object('ok',true,'ja_pago',false,'valor',p_valor);
  END IF;
  IF g.status='pendente' THEN RETURN jsonb_build_object('ok',true,'ja_pendente',true); END IF;
  UPDATE public.folha_pagamentos SET status='pendente', desfeito_por=p_usuario, motivo_desfazer=trim(p_motivo) WHERE id=g.id;
  RETURN jsonb_build_object('ok',true,'ja_pendente',false);
END $$;
REVOKE ALL ON FUNCTION public.folha_registrar_pagamento_interno(uuid,uuid,text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.folha_registrar_pagamento_interno(uuid,uuid,text,numeric,text) TO service_role;

-- A versão antiga (sem motivo/permissão/trava) deixa de ser usada pelo servidor.
REVOKE ALL ON FUNCTION public.folha_registrar_pagamento(uuid,uuid,text,numeric) FROM service_role;
COMMENT ON FUNCTION public.folha_registrar_pagamento(uuid,uuid,text,numeric) IS 'DEPRECATED: replaced by folha_registrar_pagamento_interno';
COMMENT ON COLUMN public.folha_pagamentos.status IS 'Controle interno da folha. Confirmar NÃO executa transferência e NÃO cria/baixa conta a pagar.';