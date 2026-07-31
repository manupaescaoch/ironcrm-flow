CREATE OR REPLACE FUNCTION public.submit_nps_resposta(
  p_nome text,
  p_whatsapp text,
  p_unidade_nome text,
  p_nota_nps smallint,
  p_estrelas_estrutura smallint,
  p_estrelas_equipe smallint,
  p_estrelas_treino smallint,
  p_pontos_positivos text[],
  p_pontos_melhoria text[],
  p_tempo_aluno text,
  p_comentario text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_nome text := upper(btrim(coalesce(p_nome, '')));
  v_whatsapp text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_unidade text := upper(btrim(coalesce(p_unidade_nome, '')));
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
BEGIN
  IF length(v_nome) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;
  IF v_whatsapp !~ '^[0-9]{10,13}$' THEN
    RAISE EXCEPTION 'WhatsApp inválido';
  END IF;
  IF v_unidade <> ALL (ARRAY['MADALENA', 'BOA VIAGEM', 'SETÚBAL']) THEN
    RAISE EXCEPTION 'Unidade inválida';
  END IF;
  IF p_nota_nps NOT BETWEEN 0 AND 10 THEN
    RAISE EXCEPTION 'Nota NPS inválida';
  END IF;
  IF p_estrelas_estrutura NOT BETWEEN 1 AND 5
     OR p_estrelas_equipe NOT BETWEEN 1 AND 5
     OR p_estrelas_treino NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Avaliação por estrelas inválida';
  END IF;
  IF coalesce(array_length(p_pontos_positivos, 1), 0) > 20
     OR coalesce(array_length(p_pontos_melhoria, 1), 0) > 20 THEN
    RAISE EXCEPTION 'Quantidade de opções inválida';
  END IF;
  IF p_tempo_aluno <> ALL (ARRAY['Menos de 1 mês', '1 a 3 meses', '3 a 6 meses', '6 meses a 1 ano', 'Mais de 1 ano']) THEN
    RAISE EXCEPTION 'Tempo de aluno inválido';
  END IF;
  IF v_comentario IS NOT NULL AND length(v_comentario) > 1000 THEN
    RAISE EXCEPTION 'Comentário muito longo';
  END IF;

  INSERT INTO public.nps_respostas (
    nome, whatsapp, unidade_nome, nota_nps,
    estrelas_estrutura, estrelas_equipe, estrelas_treino,
    pontos_positivos, pontos_melhoria, tempo_aluno, comentario
  ) VALUES (
    v_nome, v_whatsapp, v_unidade, p_nota_nps,
    p_estrelas_estrutura, p_estrelas_equipe, p_estrelas_treino,
    coalesce(p_pontos_positivos, '{}'::text[]),
    coalesce(p_pontos_melhoria, '{}'::text[]),
    p_tempo_aluno, v_comentario
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_nps_resposta(text, text, text, smallint, smallint, smallint, smallint, text[], text[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_nps_resposta(text, text, text, smallint, smallint, smallint, smallint, text[], text[], text, text) TO anon, authenticated, service_role;