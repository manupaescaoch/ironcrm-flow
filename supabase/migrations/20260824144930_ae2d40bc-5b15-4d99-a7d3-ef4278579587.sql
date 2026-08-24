-- Restringe as políticas de administrador ao papel autenticado.
-- Visitantes anônimos deixam de avaliar has_role (que eles não podem executar),
-- o que hoje derruba a leitura pública dos formulários ativos.

-- formularios
DROP POLICY IF EXISTS select_formularios_admin ON public.formularios;
CREATE POLICY select_formularios_admin ON public.formularios
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS insert_formularios_admin ON public.formularios;
CREATE POLICY insert_formularios_admin ON public.formularios
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS update_formularios_admin ON public.formularios;
CREATE POLICY update_formularios_admin ON public.formularios
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS delete_formularios_admin ON public.formularios;
CREATE POLICY delete_formularios_admin ON public.formularios
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

-- formulario_campos
DROP POLICY IF EXISTS select_formulario_campos_admin ON public.formulario_campos;
CREATE POLICY select_formulario_campos_admin ON public.formulario_campos
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS insert_formulario_campos_admin ON public.formulario_campos;
CREATE POLICY insert_formulario_campos_admin ON public.formulario_campos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS update_formulario_campos_admin ON public.formulario_campos;
CREATE POLICY update_formulario_campos_admin ON public.formulario_campos
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS delete_formulario_campos_admin ON public.formulario_campos;
CREATE POLICY delete_formulario_campos_admin ON public.formulario_campos
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));