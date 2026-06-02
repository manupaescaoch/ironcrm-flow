DROP POLICY IF EXISTS insert_reunioes_admin_coord ON public.reunioes;
DROP POLICY IF EXISTS update_reunioes_admin_coord ON public.reunioes;
DROP POLICY IF EXISTS delete_reunioes_admin_coord ON public.reunioes;

CREATE POLICY insert_reunioes_by_unidade ON public.reunioes
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      (has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'user'::app_role))
      AND unidade_id IN (SELECT get_user_unidades(auth.uid()))
    )
  )
);

CREATE POLICY update_reunioes_admin_coord ON public.reunioes
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);

CREATE POLICY delete_reunioes_admin_coord ON public.reunioes
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);