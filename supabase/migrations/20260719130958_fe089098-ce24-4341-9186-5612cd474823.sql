CREATE OR REPLACE FUNCTION public.admin_bulk_update_cronograma(
  p_ids uuid[],
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_add_dias integer[] DEFAULT NULL::integer[],
  p_replace_dias integer[] DEFAULT NULL::integer[],
  p_duplicate boolean DEFAULT false,
  p_delete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    -- Preservar histórico de envios: desvincular ao invés de bloquear
    UPDATE public.cronograma_envios SET atividade_id = NULL WHERE atividade_id = ANY(p_ids);
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
    RETURN jsonb_build_object('affected',v_affected,'bulk_operation_id',v_bulk,'duplicated',true);
  END IF;

  IF p_patch IS NOT NULL AND p_patch <> '{}'::jsonb THEN
    UPDATE public.cronograma_atividades a SET
      titulo = COALESCE(p_patch->>'titulo', a.titulo),
      horario = COALESCE((p_patch->>'horario')::time, a.horario),
      responsavel_id = COALESCE((p_patch->>'responsavel_id')::uuid, a.responsavel_id),
      formulario_id = CASE WHEN p_patch ? 'formulario_id' THEN NULLIF(p_patch->>'formulario_id','')::uuid ELSE a.formulario_id END,
      mensagem = CASE WHEN p_patch ? 'mensagem' THEN NULLIF(p_patch->>'mensagem','') ELSE a.mensagem END,
      ativo = COALESCE((p_patch->>'ativo')::boolean, a.ativo),
      turno = CASE WHEN p_patch ? 'turno' THEN NULLIF(p_patch->>'turno','') ELSE a.turno END,
      tipo_atividade = CASE WHEN p_patch ? 'tipo_atividade' THEN NULLIF(p_patch->>'tipo_atividade','') ELSE a.tipo_atividade END,
      unidade_id = COALESCE((p_patch->>'unidade_id')::uuid, a.unidade_id)
    WHERE a.id = ANY(p_ids);
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  END IF;

  IF p_replace_dias IS NOT NULL THEN
    FOR v_rec IN SELECT * FROM public.cronograma_atividades WHERE id = ANY(p_ids) LOOP
      DELETE FROM public.cronograma_atividades WHERE id = v_rec.id;
      FOREACH v_dia IN ARRAY p_replace_dias LOOP
        INSERT INTO public.cronograma_atividades (unidade_id, formulario_id, responsavel_id, titulo, horario, dia_semana, mensagem, ativo, turno, tipo_atividade)
        VALUES (v_rec.unidade_id, v_rec.formulario_id, v_rec.responsavel_id, v_rec.titulo, v_rec.horario, v_dia, v_rec.mensagem, v_rec.ativo, v_rec.turno, v_rec.tipo_atividade);
      END LOOP;
    END LOOP;
  ELSIF p_add_dias IS NOT NULL THEN
    FOR v_rec IN SELECT * FROM public.cronograma_atividades WHERE id = ANY(p_ids) LOOP
      FOREACH v_dia IN ARRAY p_add_dias LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.cronograma_atividades
          WHERE titulo = v_rec.titulo AND horario IS NOT DISTINCT FROM v_rec.horario
            AND responsavel_id IS NOT DISTINCT FROM v_rec.responsavel_id
            AND unidade_id = v_rec.unidade_id AND dia_semana = v_dia
        ) THEN
          INSERT INTO public.cronograma_atividades (unidade_id, formulario_id, responsavel_id, titulo, horario, dia_semana, mensagem, ativo, turno, tipo_atividade)
          VALUES (v_rec.unidade_id, v_rec.formulario_id, v_rec.responsavel_id, v_rec.titulo, v_rec.horario, v_dia, v_rec.mensagem, v_rec.ativo, v_rec.turno, v_rec.tipo_atividade);
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('affected',v_affected,'bulk_operation_id',v_bulk);
END;
$function$;