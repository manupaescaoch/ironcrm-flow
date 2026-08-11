DROP POLICY IF EXISTS insert_cronograma_func_admin ON public.cronograma_funcionarios;
DROP POLICY IF EXISTS update_cronograma_func_admin ON public.cronograma_funcionarios;
DROP POLICY IF EXISTS delete_cronograma_func_admin ON public.cronograma_funcionarios;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_funcionarios TO authenticated;
GRANT ALL ON public.cronograma_funcionarios TO service_role;

CREATE POLICY insert_cronograma_func_unidade ON public.cronograma_funcionarios
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin') OR unidade_id IN (SELECT get_user_unidades(auth.uid())));

CREATE POLICY update_cronograma_func_unidade ON public.cronograma_funcionarios
FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin') OR unidade_id IN (SELECT get_user_unidades(auth.uid())))
WITH CHECK (has_role(auth.uid(),'admin') OR unidade_id IN (SELECT get_user_unidades(auth.uid())));

CREATE POLICY delete_cronograma_func_unidade ON public.cronograma_funcionarios
FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin') OR unidade_id IN (SELECT get_user_unidades(auth.uid())));