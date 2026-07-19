CREATE OR REPLACE FUNCTION public.admin_bulk_update_cronograma(
  p_ids uuid[],
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_add_dias int[] DEFAULT NULL,
  p_replace_dias int[] DEFAULT NULL,
  p_duplicate boolean DEFAULT false,
  p_delete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bulk uuid := gen_random_uuid();
  v_affected int := 0;
  v_id uuid;
  v_dia int;
  v_rec record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF p_ids IS NULL OR array_length(p_ids,1) IS NULL THEN
    RETURN jsonb_build_object('affected',0,'bulk_operation_id',v_bulk);
  END IF;

  PERFORM set_config('app.bulk_operation_id', v_bulk::text, true);

  IF p_delete THEN
    -- Hard delete: remove definitivamente da grade
    DELETE FROM public.cronograma_atividades_historico WHERE atividade_id = ANY(p_ids);
    DELETE FROM public.cronograma_atividades WHERE id = ANY(p_ids);
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN jsonb_build_object('affected',v_affected,'bulk_operation_id',v_bulk,'deleted',true);
  END IF;

  IF p_duplicate THEN
    INSERT INTO public.cronograma_atividades (unidade_id, formulario_id, responsavel_id, titulo, horario, dia_semana, mensagem, ativo, turno, tipo_atividade)
    SELECT unidade_id, formulario_id, responsavel_id, titulo, horario, dia_semana, mensagem, ativo, turno, tipo_atividade
    FROM public.cronograma_atividades WHERE id = ANY(p_ids);
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN jsonb_build_object('affected',v_affected,'bulk_operation_id',v_bulk);
  END IF;

  IF p_patch <> '{}'::jsonb THEN
    UPDATE public.cronograma_atividades a SET
      ativo = COALESCE((p_patch->>'ativo')::boolean, a.ativo),
      horario = CASE WHEN p_patch ? 'horario' THEN NULLIF(p_patch->>'horario','')::time ELSE a.horario END,
      responsavel_id = CASE WHEN p_patch ? 'responsavel_id' THEN NULLIF(p_patch->>'responsavel_id','')::uuid ELSE a.responsavel_id END,
      formulario_id = CASE WHEN p_patch ? 'formulario_id' THEN NULLIF(p_patch->>'formulario_id','')::uuid ELSE a.formulario_id END,
      unidade_id = CASE WHEN p_patch ? 'unidade_id' THEN (p_patch->>'unidade_id')::uuid ELSE a.unidade_id END,
      turno = CASE WHEN p_patch ? 'turno' THEN NULLIF(p_patch->>'turno','') ELSE a.turno END,
      mensagem = CASE WHEN p_patch ? 'mensagem' THEN NULLIF(p_patch->>'mensagem','') ELSE a.mensagem END,
      titulo = CASE WHEN p_patch ? 'titulo' THEN p_patch->>'titulo' ELSE a.titulo END,
      tipo_atividade = CASE WHEN p_patch ? 'tipo_atividade' THEN p_patch->>'tipo_atividade' ELSE a.tipo_atividade END,
      updated_at = now()
    WHERE a.id = ANY(p_ids);
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSE
    v_affected := array_length(p_ids,1);
  END IF;

  IF p_replace_dias IS NOT NULL AND array_length(p_replace_dias,1) IS NOT NULL THEN
    FOR v_id IN SELECT unnest(p_ids) LOOP
      SELECT * INTO v_rec FROM public.cronograma_atividades WHERE id = v_id;
      IF NOT FOUND THEN CONTINUE; END IF;
      UPDATE public.cronograma_atividades SET dia_semana = p_replace_dias[1], updated_at = now() WHERE id = v_id;
      IF array_length(p_replace_dias,1) > 1 THEN
        FOR i IN 2..array_length(p_replace_dias,1) LOOP
          INSERT INTO public.cronograma_atividades (unidade_id, formulario_id, responsavel_id, titulo, horario, dia_semana, mensagem, ativo, turno, tipo_atividade)
          VALUES (v_rec.unidade_id, v_rec.formulario_id, v_rec.responsavel_id, v_rec.titulo, v_rec.horario, p_replace_dias[i], v_rec.mensagem, v_rec.ativo, v_rec.turno, v_rec.tipo_atividade);
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  IF p_add_dias IS NOT NULL AND array_length(p_add_dias,1) IS NOT NULL THEN
    FOR v_id IN SELECT unnest(p_ids) LOOP
      SELECT * INTO v_rec FROM public.cronograma_atividades WHERE id = v_id;
      IF NOT FOUND THEN CONTINUE; END IF;
      FOREACH v_dia IN ARRAY p_add_dias LOOP
        IF v_dia = v_rec.dia_semana THEN CONTINUE; END IF;
        INSERT INTO public.cronograma_atividades (unidade_id, formulario_id, responsavel_id, titulo, horario, dia_semana, mensagem, ativo, turno, tipo_atividade)
        VALUES (v_rec.unidade_id, v_rec.formulario_id, v_rec.responsavel_id, v_rec.titulo, v_rec.horario, v_dia, v_rec.mensagem, v_rec.ativo, v_rec.turno, v_rec.tipo_atividade);
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('affected', v_affected, 'bulk_operation_id', v_bulk);
END;
$$;