
-- =========================================================
-- encerramento_coordenador_respostas
-- =========================================================
DROP POLICY IF EXISTS "Anyone can insert encerramento coordenador" ON public.encerramento_coordenador_respostas;

CREATE POLICY "insert_encerramento_coordenador_authenticated"
ON public.encerramento_coordenador_respostas
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND nome IS NOT NULL AND char_length(trim(nome)) BETWEEN 1 AND 200
  AND unidade IS NOT NULL AND char_length(trim(unidade)) BETWEEN 1 AND 100
  AND turno IS NOT NULL AND char_length(trim(turno)) BETWEEN 1 AND 50
);

-- =========================================================
-- encerramento_horario_respostas
-- =========================================================
DROP POLICY IF EXISTS "Anyone can insert encerramento horario" ON public.encerramento_horario_respostas;

CREATE POLICY "insert_encerramento_horario_authenticated"
ON public.encerramento_horario_respostas
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND nome IS NOT NULL AND char_length(trim(nome)) BETWEEN 1 AND 200
  AND unidade IS NOT NULL AND char_length(trim(unidade)) BETWEEN 1 AND 100
  AND turno IS NOT NULL AND char_length(trim(turno)) BETWEEN 1 AND 50
  AND data IS NOT NULL
);

-- =========================================================
-- encerramento_turno_respostas
-- =========================================================
DROP POLICY IF EXISTS "anon_insert_encerramento_turno" ON public.encerramento_turno_respostas;

CREATE POLICY "insert_encerramento_turno_authenticated"
ON public.encerramento_turno_respostas
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND nome IS NOT NULL AND char_length(trim(nome)) BETWEEN 1 AND 200
  AND unidade IS NOT NULL AND char_length(trim(unidade)) BETWEEN 1 AND 100
  AND turno IS NOT NULL AND char_length(trim(turno)) BETWEEN 1 AND 50
);

-- =========================================================
-- formulario_respostas
-- Públicos via /formulario/:id, mas validados contra formulario ativo e unidade correta
-- =========================================================
DROP POLICY IF EXISTS "insert_respostas_anon" ON public.formulario_respostas;
DROP POLICY IF EXISTS "insert_respostas_authenticated" ON public.formulario_respostas;

CREATE POLICY "insert_respostas_validated_anon"
ON public.formulario_respostas
FOR INSERT
TO anon
WITH CHECK (
  formulario_id IS NOT NULL
  AND unidade_id IS NOT NULL
  AND respondido_por_nome IS NOT NULL
  AND char_length(trim(respondido_por_nome)) BETWEEN 1 AND 200
  AND respostas IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.formularios f
    WHERE f.id = formulario_id
      AND f.ativo = true
      AND f.unidade_id = formulario_respostas.unidade_id
  )
);

CREATE POLICY "insert_respostas_validated_authenticated"
ON public.formulario_respostas
FOR INSERT
TO authenticated
WITH CHECK (
  formulario_id IS NOT NULL
  AND unidade_id IS NOT NULL
  AND respondido_por_nome IS NOT NULL
  AND char_length(trim(respondido_por_nome)) BETWEEN 1 AND 200
  AND respostas IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.formularios f
    WHERE f.id = formulario_id
      AND f.ativo = true
      AND f.unidade_id = formulario_respostas.unidade_id
  )
);
