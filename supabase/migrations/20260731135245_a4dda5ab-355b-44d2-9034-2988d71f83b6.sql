GRANT INSERT ON public.nps_respostas TO anon;
GRANT SELECT, INSERT ON public.nps_respostas TO authenticated;
GRANT ALL ON public.nps_respostas TO service_role;

DROP POLICY IF EXISTS insert_nps_respostas_public_validated ON public.nps_respostas;
CREATE POLICY insert_nps_respostas_public_validated
ON public.nps_respostas FOR INSERT TO anon, authenticated
WITH CHECK (
  nome IS NOT NULL
  AND length(btrim(nome)) BETWEEN 2 AND 120
  AND whatsapp IS NOT NULL
  AND regexp_replace(whatsapp, '[^0-9]', '', 'g') ~ '^[0-9]{10,13}$'
  AND unidade_nome = ANY (ARRAY['MADALENA','BOA VIAGEM','SETÚBAL'])
  AND nota_nps BETWEEN 0 AND 10
  AND estrelas_estrutura BETWEEN 1 AND 5
  AND estrelas_equipe BETWEEN 1 AND 5
  AND estrelas_treino BETWEEN 1 AND 5
  AND (pontos_positivos IS NULL OR coalesce(array_length(pontos_positivos,1),0) <= 20)
  AND (pontos_melhoria IS NULL OR coalesce(array_length(pontos_melhoria,1),0) <= 20)
  AND tempo_aluno = ANY (ARRAY['Menos de 1 mês','1 a 3 meses','3 a 6 meses','6 meses a 1 ano','Mais de 1 ano'])
  AND (comentario IS NULL OR length(comentario) <= 1000)
);