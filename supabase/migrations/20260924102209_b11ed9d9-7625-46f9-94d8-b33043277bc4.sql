DROP POLICY "Admins veem cancelamentos" ON public.cancelamento_solicitacoes;
DROP POLICY "Admins atualizam cancelamentos" ON public.cancelamento_solicitacoes;
CREATE POLICY "Gestao ve cancelamentos" ON public.cancelamento_solicitacoes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR ((public.has_role(auth.uid(),'gerente') OR public.has_role(auth.uid(),'coordenador')) AND public.user_has_unidade_access(auth.uid(), unidade_id)));
CREATE POLICY "Gestao atualiza cancelamentos" ON public.cancelamento_solicitacoes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR ((public.has_role(auth.uid(),'gerente') OR public.has_role(auth.uid(),'coordenador')) AND public.user_has_unidade_access(auth.uid(), unidade_id)));