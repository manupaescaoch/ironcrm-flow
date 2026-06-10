GRANT INSERT ON public.relatorio_diario_comercial_respostas TO anon;

CREATE POLICY insert_relatorio_diario_comercial_public
ON public.relatorio_diario_comercial_respostas
FOR INSERT
TO anon, authenticated
WITH CHECK (
  nome IS NOT NULL
  AND char_length(btrim(nome)) BETWEEN 1 AND 200
  AND unidade IS NOT NULL
  AND char_length(btrim(unidade)) BETWEEN 1 AND 100
  AND data IS NOT NULL
  AND submitted_by IS NULL
);