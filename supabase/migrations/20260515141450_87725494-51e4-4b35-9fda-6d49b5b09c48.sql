
-- encerramento_turno_respostas
DROP POLICY IF EXISTS "insert_encerramento_turno_authenticated" ON public.encerramento_turno_respostas;
CREATE POLICY "insert_encerramento_turno_public"
ON public.encerramento_turno_respostas
FOR INSERT
TO anon, authenticated
WITH CHECK (
  nome IS NOT NULL AND char_length(trim(nome)) BETWEEN 1 AND 200
  AND unidade IS NOT NULL AND char_length(trim(unidade)) BETWEEN 1 AND 100
  AND turno IS NOT NULL AND char_length(trim(turno)) BETWEEN 1 AND 50
);

-- encerramento_horario_respostas
DROP POLICY IF EXISTS "insert_encerramento_horario_authenticated" ON public.encerramento_horario_respostas;
CREATE POLICY "insert_encerramento_horario_public"
ON public.encerramento_horario_respostas
FOR INSERT
TO anon, authenticated
WITH CHECK (
  nome IS NOT NULL AND char_length(trim(nome)) BETWEEN 1 AND 200
  AND unidade IS NOT NULL AND char_length(trim(unidade)) BETWEEN 1 AND 100
  AND turno IS NOT NULL AND char_length(trim(turno)) BETWEEN 1 AND 50
  AND data IS NOT NULL
);

-- encerramento_coordenador_respostas
DROP POLICY IF EXISTS "insert_encerramento_coordenador_authenticated" ON public.encerramento_coordenador_respostas;
CREATE POLICY "insert_encerramento_coordenador_public"
ON public.encerramento_coordenador_respostas
FOR INSERT
TO anon, authenticated
WITH CHECK (
  nome IS NOT NULL AND char_length(trim(nome)) BETWEEN 1 AND 200
  AND unidade IS NOT NULL AND char_length(trim(unidade)) BETWEEN 1 AND 100
  AND turno IS NOT NULL AND char_length(trim(turno)) BETWEEN 1 AND 50
);

-- relatorio_diario_comercial_respostas
DROP POLICY IF EXISTS "insert_relatorio_diario_comercial_authenticated" ON public.relatorio_diario_comercial_respostas;
CREATE POLICY "insert_relatorio_diario_comercial_public"
ON public.relatorio_diario_comercial_respostas
FOR INSERT
TO anon, authenticated
WITH CHECK (
  nome IS NOT NULL AND char_length(trim(nome)) BETWEEN 1 AND 200
  AND unidade IS NOT NULL AND char_length(trim(unidade)) BETWEEN 1 AND 100
  AND data IS NOT NULL
);

GRANT INSERT ON TABLE public.encerramento_turno_respostas TO anon, authenticated;
GRANT INSERT ON TABLE public.encerramento_horario_respostas TO anon, authenticated;
GRANT INSERT ON TABLE public.encerramento_coordenador_respostas TO anon, authenticated;
GRANT INSERT ON TABLE public.relatorio_diario_comercial_respostas TO anon, authenticated;
