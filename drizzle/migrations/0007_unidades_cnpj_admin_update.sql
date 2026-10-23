GRANT UPDATE (cnpj) ON public.unidades TO authenticated;
CREATE POLICY unidades_admin_update_cnpj ON public.unidades FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));