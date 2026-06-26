
-- Tighten public INSERT on nps_respostas with strong validation
DROP POLICY IF EXISTS "Qualquer um pode enviar avaliação NPS" ON public.nps_respostas;

CREATE POLICY "insert_nps_respostas_public_validated"
ON public.nps_respostas
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- nome
  nome IS NOT NULL
  AND length(btrim(nome)) BETWEEN 2 AND 120

  -- whatsapp (somente dígitos, 10 a 13)
  AND whatsapp IS NOT NULL
  AND length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) BETWEEN 10 AND 13
  AND regexp_replace(whatsapp, '[^0-9]', '', 'g') ~ '^[0-9]{10,13}$'

  -- unidade controlada
  AND unidade_nome IN ('MADALENA', 'BOA VIAGEM', 'SETÚBAL')

  -- nota NPS 0..10
  AND nota_nps BETWEEN 0 AND 10

  -- estrelas 1..5
  AND estrelas_estrutura BETWEEN 1 AND 5
  AND estrelas_equipe    BETWEEN 1 AND 5
  AND estrelas_treino    BETWEEN 1 AND 5

  -- arrays com tamanho razoável
  AND array_length(pontos_positivos, 1) IS NULL OR array_length(pontos_positivos, 1) <= 20
  AND (array_length(pontos_melhoria, 1) IS NULL OR array_length(pontos_melhoria, 1) <= 20)

  -- tempo_aluno controlado
  AND tempo_aluno IN (
    'Menos de 1 mês',
    '1 a 3 meses',
    '3 a 6 meses',
    '6 meses a 1 ano',
    'Mais de 1 ano'
  )

  -- comentário limitado
  AND (comentario IS NULL OR length(comentario) <= 1000)

  -- categoria não pode ser definida pelo cliente (será derivada server-side se necessário)
  AND categoria IS NULL
);

-- Garantir que anon/authenticated NÃO tenham UPDATE/DELETE (nenhuma policy existe; revogar privilégios de tabela por segurança defensiva)
REVOKE UPDATE, DELETE ON public.nps_respostas FROM anon, authenticated;
GRANT INSERT ON public.nps_respostas TO anon, authenticated;
GRANT SELECT ON public.nps_respostas TO authenticated;
GRANT ALL ON public.nps_respostas TO service_role;
