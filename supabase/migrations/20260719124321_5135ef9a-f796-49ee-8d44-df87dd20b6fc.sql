
DO $$
DECLARE
  v_bulk uuid := gen_random_uuid();
  v_count int;
BEGIN
  PERFORM set_config('app.bulk_operation_id', v_bulk::text, true);

  WITH ranked AS (
    SELECT id, ativo,
      ROW_NUMBER() OVER (
        PARTITION BY tipo_atividade, unidade_id, responsavel_id, dia_semana, horario, turno
        ORDER BY ativo DESC, created_at ASC, id ASC
      ) AS rn
    FROM public.cronograma_atividades
  ),
  to_pause AS (
    SELECT id FROM ranked WHERE rn > 1 AND ativo = true
  ),
  upd AS (
    UPDATE public.cronograma_atividades
    SET ativo = false, updated_at = now()
    WHERE id IN (SELECT id FROM to_pause)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upd;

  RAISE NOTICE 'Duplicidades pausadas: %', v_count;
END $$;
