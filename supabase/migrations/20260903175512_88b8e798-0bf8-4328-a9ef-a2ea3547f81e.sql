DROP POLICY IF EXISTS insert_rotinas_by_unidade ON public.rotinas;
CREATE POLICY insert_rotinas_by_unidade ON public.rotinas FOR INSERT TO authenticated
WITH CHECK ((auth.uid() IS NOT NULL) AND (has_role(auth.uid(), 'admin'::app_role) OR ((has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'user'::app_role)) AND (unidade_id IN (SELECT get_user_unidades(auth.uid()))))));

DROP POLICY IF EXISTS update_rotinas_by_unidade ON public.rotinas;
CREATE POLICY update_rotinas_by_unidade ON public.rotinas FOR UPDATE TO authenticated
USING ((auth.uid() IS NOT NULL) AND (has_role(auth.uid(), 'admin'::app_role) OR ((has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'user'::app_role)) AND (unidade_id IN (SELECT get_user_unidades(auth.uid()))))))
WITH CHECK ((auth.uid() IS NOT NULL) AND (has_role(auth.uid(), 'admin'::app_role) OR ((has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'user'::app_role)) AND (unidade_id IN (SELECT get_user_unidades(auth.uid()))))));

DROP POLICY IF EXISTS delete_rotinas_admin_coord_comercial ON public.rotinas;
CREATE POLICY delete_rotinas_admin_coord_comercial ON public.rotinas FOR DELETE TO authenticated
USING ((auth.uid() IS NOT NULL) AND (has_role(auth.uid(), 'admin'::app_role) OR ((has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'user'::app_role)) AND (unidade_id IN (SELECT get_user_unidades(auth.uid()))))));

DROP POLICY IF EXISTS insert_rotina_atividades ON public.rotina_atividades;
CREATE POLICY insert_rotina_atividades ON public.rotina_atividades FOR INSERT TO authenticated
WITH CHECK ((auth.uid() IS NOT NULL) AND EXISTS (SELECT 1 FROM public.rotinas r WHERE r.id = rotina_atividades.rotina_id AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR (r.unidade_id IN (SELECT get_user_unidades(auth.uid()))))));

DROP POLICY IF EXISTS update_rotina_atividades ON public.rotina_atividades;
CREATE POLICY update_rotina_atividades ON public.rotina_atividades FOR UPDATE TO authenticated
USING ((auth.uid() IS NOT NULL) AND EXISTS (SELECT 1 FROM public.rotinas r WHERE r.id = rotina_atividades.rotina_id AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR (r.unidade_id IN (SELECT get_user_unidades(auth.uid()))))));

DROP POLICY IF EXISTS delete_rotina_atividades ON public.rotina_atividades;
CREATE POLICY delete_rotina_atividades ON public.rotina_atividades FOR DELETE TO authenticated
USING ((auth.uid() IS NOT NULL) AND EXISTS (SELECT 1 FROM public.rotinas r WHERE r.id = rotina_atividades.rotina_id AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR (r.unidade_id IN (SELECT get_user_unidades(auth.uid()))))));