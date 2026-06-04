-- Remover as políticas restritivas existentes para dar lugar à nova política abrangente
DROP POLICY IF EXISTS "Admin pode tudo em gestao_metas" ON public.gestao_metas;
DROP POLICY IF EXISTS "Coordenadores podem atualizar metas da propria unidade" ON public.gestao_metas;
DROP POLICY IF EXISTS "Coordenadores podem criar metas da propria unidade" ON public.gestao_metas;
DROP POLICY IF EXISTS "select_gestao_metas_by_unidade" ON public.gestao_metas;

-- Criar novas políticas que permitem a todos os usuários autenticados gerenciar as metas
-- Nota: Usamos políticas separadas por comando para maior clareza, permitindo todas as operações para usuários autenticados.

CREATE POLICY "Usuários autenticados podem ver todas as metas"
ON public.gestao_metas
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem inserir metas"
ON public.gestao_metas
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar metas"
ON public.gestao_metas
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem excluir metas"
ON public.gestao_metas
FOR DELETE
TO authenticated
USING (true);

-- Garantir que o service_role continue tendo acesso total (geralmente implícito, mas bom reforçar se houver GRANTs específicos)
GRANT ALL ON public.gestao_metas TO authenticated;
GRANT ALL ON public.gestao_metas TO service_role;
