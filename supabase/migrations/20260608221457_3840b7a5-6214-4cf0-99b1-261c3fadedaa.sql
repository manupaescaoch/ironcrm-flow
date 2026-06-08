-- Step 1: Audit and clean up existing insecure policies
DROP POLICY IF EXISTS "Usuários autenticados podem ver todas as metas" ON public.gestao_metas;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir metas" ON public.gestao_metas;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar metas" ON public.gestao_metas;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir metas" ON public.gestao_metas;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.gestao_metas ENABLE ROW LEVEL SECURITY;

-- Step 3: Create SELECT policy scoped by unit or admin role
CREATE POLICY "select_gestao_metas_by_unidade"
ON public.gestao_metas
FOR SELECT
TO authenticated
USING (
    auth.uid() IS NOT NULL
    AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
    )
);

-- Step 4 & 5: Create INSERT/UPDATE policies restricted to admin or unit coordinator
CREATE POLICY "insert_gestao_metas_admin_coord_by_unidade"
ON public.gestao_metas
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR (
            public.has_role(auth.uid(), 'coordenador'::app_role)
            AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
        )
    )
);

CREATE POLICY "update_gestao_metas_admin_coord_by_unidade"
ON public.gestao_metas
FOR UPDATE
TO authenticated
USING (
    auth.uid() IS NOT NULL
    AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR (
            public.has_role(auth.uid(), 'coordenador'::app_role)
            AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
        )
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR (
            public.has_role(auth.uid(), 'coordenador'::app_role)
            AND unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
        )
    )
);

-- Step 6: Create DELETE policy restricted to admins only
CREATE POLICY "delete_gestao_metas_admin_only"
ON public.gestao_metas
FOR DELETE
TO authenticated
USING (
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'admin'::app_role)
);