
-- 1) Dedupe existente: manter apenas 1 linha por (titulo, horario, responsavel_id, unidade_id, dia_semana)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY titulo, horario, COALESCE(responsavel_id::text,''), unidade_id, COALESCE(dia_semana,-1)
           ORDER BY ativo DESC, created_at ASC, id ASC
         ) AS rn
  FROM public.cronograma_atividades
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
, _unlink AS (
  UPDATE public.cronograma_envios e
     SET atividade_id = NULL
   WHERE atividade_id IN (SELECT id FROM to_delete)
   RETURNING 1
)
, _hist AS (
  DELETE FROM public.cronograma_atividades_historico
   WHERE atividade_id IN (SELECT id FROM to_delete)
   RETURNING 1
)
DELETE FROM public.cronograma_atividades
 WHERE id IN (SELECT id FROM to_delete);

-- 2) Reescrever RPC: em replace_dias, tratar p_ids como UM grupo (usa 1º registro como template)
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
  v_dia int;
  v_rec record;
  v_tpl record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids,1) IS NULL THEN
    RETURN jsonb_build_object('affected',0,'bulk_operation_id',v_bulk);
  END IF;

  PERFORM set_config('app.bulk_operation_id', v_bulk::text, true);

  IF p_delete THEN
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

  -- Aplica patch primeiro (para que template use valores atualizados)
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
    -- Iterar por GRUPO (não por linha): usa 1 template por (titulo, horario, responsavel_id, unidade_id)
    FOR v_tpl IN
      SELECT DISTINCT ON (titulo, horario, COALESCE(responsavel_id::text,''), unidade_id)
             titulo, horario, responsavel_id, unidade_id, formulario_id, mensagem, ativo, turno, tipo_atividade
        FROM public.cronograma_atividades
       WHERE id = ANY(p_ids)
       ORDER BY titulo, horario, COALESCE(responsavel_id::text,''), unidade_id, ativo DESC, created_at ASC
    LOOP
      -- Remove TODAS as linhas atuais do grupo (dentro de p_ids)
      UPDATE public.cronograma_envios SET atividade_id = NULL
        WHERE atividade_id IN (
          SELECT id FROM public.cronograma_atividades
           WHERE id = ANY(p_ids)
             AND titulo = v_tpl.titulo
             AND horario IS NOT DISTINCT FROM v_tpl.horario
             AND COALESCE(responsavel_id::text,'') = COALESCE(v_tpl.responsavel_id::text,'')
             AND unidade_id = v_tpl.unidade_id
        );

      DELETE FROM public.cronograma_atividades_historico
        WHERE atividade_id IN (
          SELECT id FROM public.cronograma_atividades
           WHERE id = ANY(p_ids)
             AND titulo = v_tpl.titulo
             AND horario IS NOT DISTINCT FROM v_tpl.horario
             AND COALESCE(responsavel_id::text,'') = COALESCE(v_tpl.responsavel_id::text,'')
             AND unidade_id = v_tpl.unidade_id
        );

      DELETE FROM public.cronograma_atividades
       WHERE id = ANY(p_ids)
         AND titulo = v_tpl.titulo
         AND horario IS NOT DISTINCT FROM v_tpl.horario
         AND COALESCE(responsavel_id::text,'') = COALESCE(v_tpl.responsavel_id::text,'')
         AND unidade_id = v_tpl.unidade_id;

      -- Insere UMA linha por dia selecionado
      FOREACH v_dia IN ARRAY p_replace_dias LOOP
        INSERT INTO public.cronograma_atividades
          (unidade_id, formulario_id, responsavel_id, titulo, horario, dia_semana, mensagem, ativo, turno, tipo_atividade)
        VALUES
          (v_tpl.unidade_id, v_tpl.formulario_id, v_tpl.responsavel_id, v_tpl.titulo, v_tpl.horario, v_dia, v_tpl.mensagem, v_tpl.ativo, v_tpl.turno, v_tpl.tipo_atividade);
        v_affected := v_affected + 1;
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
          v_affected := v_affected + 1;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('affected',v_affected,'bulk_operation_id',v_bulk);
END;
$function$;

-- 3) Índice único para prevenir novas duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS ux_cronograma_atividades_unico
  ON public.cronograma_atividades
  (titulo, horario, unidade_id, dia_semana, COALESCE(responsavel_id, '00000000-0000-0000-0000-000000000000'::uuid));
