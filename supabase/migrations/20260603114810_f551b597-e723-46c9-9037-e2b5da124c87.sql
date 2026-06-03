
-- ============================================================
-- POLICIES FOR gestao_metas
-- ============================================================

CREATE POLICY "Coordenadores podem atualizar metas da propria unidade"
ON public.gestao_metas
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'coordenador')
  AND unidade_id IN (
    SELECT unidade_id
    FROM public.user_unidades
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'coordenador')
  AND unidade_id IN (
    SELECT unidade_id
    FROM public.user_unidades
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Coordenadores podem criar metas da propria unidade"
ON public.gestao_metas
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'coordenador')
  AND unidade_id IN (
    SELECT unidade_id
    FROM public.user_unidades
    WHERE user_id = auth.uid()
  )
);

-- ============================================================
-- POLICIES FOR gestao_lancamentos_semanais
-- ============================================================

CREATE POLICY "Coordenadores podem inserir lancamentos da propria unidade"
ON public.gestao_lancamentos_semanais
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'coordenador')
  AND unidade_id IN (
    SELECT unidade_id
    FROM public.user_unidades
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Coordenadores podem atualizar lancamentos da propria unidade"
ON public.gestao_lancamentos_semanais
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'coordenador')
  AND unidade_id IN (
    SELECT unidade_id
    FROM public.user_unidades
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'coordenador')
  AND unidade_id IN (
    SELECT unidade_id
    FROM public.user_unidades
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Coordenadores podem deletar lancamentos da propria unidade"
ON public.gestao_lancamentos_semanais
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'coordenador')
  AND unidade_id IN (
    SELECT unidade_id
    FROM public.user_unidades
    WHERE user_id = auth.uid()
  )
);
