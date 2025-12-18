-- Atualizar políticas RLS para leads (filtrar por unidade)
DROP POLICY IF EXISTS "select_all_leads_for_authenticated" ON public.leads;
CREATE POLICY "select_leads_by_unidade"
ON public.leads FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Authenticated users can create leads" ON public.leads;
CREATE POLICY "create_leads_by_unidade"
ON public.leads FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

DROP POLICY IF EXISTS "update_leads_authenticated" ON public.leads;
CREATE POLICY "update_leads_by_unidade"
ON public.leads FOR UPDATE
USING (
  auth.uid() IS NOT NULL 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

-- Atualizar políticas RLS para interacoes
DROP POLICY IF EXISTS "Authenticated users can view all interacoes" ON public.interacoes;
CREATE POLICY "select_interacoes_by_unidade"
ON public.interacoes FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Authenticated users can create interacoes" ON public.interacoes;
CREATE POLICY "create_interacoes_by_unidade"
ON public.interacoes FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

DROP POLICY IF EXISTS "update_interacoes_authenticated" ON public.interacoes;
CREATE POLICY "update_interacoes_by_unidade"
ON public.interacoes FOR UPDATE
USING (
  auth.uid() IS NOT NULL 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

-- Atualizar políticas para estoque
DROP POLICY IF EXISTS "Authenticated can view estoque" ON public.estoque_interno;
CREATE POLICY "select_estoque_by_unidade"
ON public.estoque_interno FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Authenticated can view movimentacoes" ON public.movimentacoes_estoque;
CREATE POLICY "select_movimentacoes_by_unidade"
ON public.movimentacoes_estoque FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Authenticated can create movimentacoes" ON public.movimentacoes_estoque;
CREATE POLICY "create_movimentacoes_by_unidade"
ON public.movimentacoes_estoque FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

-- Atualizar política para relatorio_gerencial_zn
DROP POLICY IF EXISTS "Authenticated users can view reports" ON public.relatorio_gerencial_zn;
CREATE POLICY "select_relatorio_by_unidade"
ON public.relatorio_gerencial_zn FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Admins can insert reports" ON public.relatorio_gerencial_zn;
CREATE POLICY "insert_relatorio_admin"
ON public.relatorio_gerencial_zn FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update reports" ON public.relatorio_gerencial_zn;
CREATE POLICY "update_relatorio_admin"
ON public.relatorio_gerencial_zn FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete reports" ON public.relatorio_gerencial_zn;
CREATE POLICY "delete_relatorio_admin"
ON public.relatorio_gerencial_zn FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));