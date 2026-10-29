-- Conflito de concorrência usa código próprio: com 40001 a API do banco repetia a transação até estourar o tempo.
CREATE OR REPLACE FUNCTION public.folha_registrar_fechamento(
  p_unidade uuid, p_comp text, p_usuario uuid, p_hash text, p_regras jsonb, p_snapshot jsonb, p_pagamentos jsonb, p_versao text, p_total numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE k record; p jsonb;
BEGIN
  PERFORM set_config('folha.usuario', p_usuario::text, true);
  PERFORM pg_advisory_xact_lock(hashtext('folha:' || p_unidade::text || ':' || p_comp));
  SELECT * INTO k FROM public.folha_competencias WHERE unidade_id=p_unidade AND competencia=p_comp FOR UPDATE;
  IF FOUND AND k.status='fechada' THEN
    RETURN jsonb_build_object('ok', true, 'ja_fechada', true, 'competencia_id', k.id, 'total', k.total);
  END IF;
  IF public.folha_hash_entrada(p_unidade, p_comp) IS DISTINCT FROM p_hash THEN
    RAISE EXCEPTION 'Dados da folha mudaram durante o fechamento; tente novamente' USING ERRCODE='PT409';
  END IF;
  IF NOT FOUND THEN
    INSERT INTO public.folha_competencias(unidade_id, competencia) VALUES (p_unidade, p_comp) RETURNING * INTO k;
  END IF;
  FOR p IN SELECT * FROM jsonb_array_elements(p_pagamentos) LOOP
    INSERT INTO public.folha_pagamentos(unidade_id, colaborador_id, competencia, valor, colaborador_nome, pix, versao_calculo, status)
    VALUES (p_unidade, (p->>'colaborador_id')::uuid, p_comp, (p->>'valor')::numeric, p->>'colaborador_nome', p->>'pix', p_versao, 'pendente')
    ON CONFLICT (colaborador_id, competencia) DO UPDATE SET valor=EXCLUDED.valor, colaborador_nome=EXCLUDED.colaborador_nome,
      pix=EXCLUDED.pix, versao_calculo=EXCLUDED.versao_calculo, status='pendente';
  END LOOP;
  DELETE FROM public.folha_pagamentos WHERE unidade_id=p_unidade AND competencia=p_comp
    AND colaborador_id NOT IN (SELECT (x->>'colaborador_id')::uuid FROM jsonb_array_elements(p_pagamentos) x);
  UPDATE public.folha_competencias SET status='fechada', regras=p_regras, snapshot=p_snapshot, versao_calculo=p_versao,
    hash_entrada=p_hash, total=p_total, fechada_por=p_usuario WHERE id=k.id;
  RETURN jsonb_build_object('ok', true, 'ja_fechada', false, 'competencia_id', k.id, 'total', p_total);
END $$;
REVOKE ALL ON FUNCTION public.folha_registrar_fechamento(uuid,text,uuid,text,jsonb,jsonb,jsonb,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.folha_registrar_fechamento(uuid,text,uuid,text,jsonb,jsonb,jsonb,text,numeric) TO service_role;