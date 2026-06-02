
-- ============================================================
-- Security hardening: scope policies to {authenticated} (not {public})
-- and add explicit auth guards. service_role bypasses RLS as before.
-- ============================================================

-- ---------- formulario_lembretes ----------
DROP POLICY IF EXISTS delete_formulario_lembretes_admin ON public.formulario_lembretes;
DROP POLICY IF EXISTS insert_formulario_lembretes_admin ON public.formulario_lembretes;
DROP POLICY IF EXISTS select_formulario_lembretes_admin ON public.formulario_lembretes;
DROP POLICY IF EXISTS update_formulario_lembretes_admin ON public.formulario_lembretes;

CREATE POLICY delete_formulario_lembretes_admin ON public.formulario_lembretes
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY insert_formulario_lembretes_admin ON public.formulario_lembretes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY select_formulario_lembretes_admin ON public.formulario_lembretes
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY update_formulario_lembretes_admin ON public.formulario_lembretes
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::app_role));

-- ---------- fornecedores ----------
DROP POLICY IF EXISTS "Usuarios podem atualizar fornecedores de suas unidades" ON public.fornecedores;
DROP POLICY IF EXISTS "Usuarios podem deletar fornecedores de suas unidades" ON public.fornecedores;
DROP POLICY IF EXISTS "Usuarios podem inserir fornecedores em suas unidades" ON public.fornecedores;
DROP POLICY IF EXISTS "Usuarios podem ver fornecedores de suas unidades" ON public.fornecedores;

CREATE POLICY "Usuarios podem ver fornecedores de suas unidades" ON public.fornecedores
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "Usuarios podem inserir fornecedores em suas unidades" ON public.fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "Usuarios podem atualizar fornecedores de suas unidades" ON public.fornecedores
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND user_has_unidade_access(auth.uid(), unidade_id));
CREATE POLICY "Usuarios podem deletar fornecedores de suas unidades" ON public.fornecedores
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND user_has_unidade_access(auth.uid(), unidade_id));

-- ---------- pagamentos_mensais ----------
DROP POLICY IF EXISTS delete_pagamentos_by_unidade ON public.pagamentos_mensais;
DROP POLICY IF EXISTS insert_pagamentos_by_unidade ON public.pagamentos_mensais;
DROP POLICY IF EXISTS select_pagamentos_by_unidade ON public.pagamentos_mensais;
DROP POLICY IF EXISTS update_pagamentos_by_unidade ON public.pagamentos_mensais;

CREATE POLICY select_pagamentos_by_unidade ON public.pagamentos_mensais
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));
CREATE POLICY insert_pagamentos_by_unidade ON public.pagamentos_mensais
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));
CREATE POLICY update_pagamentos_by_unidade ON public.pagamentos_mensais
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));
CREATE POLICY delete_pagamentos_by_unidade ON public.pagamentos_mensais
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR unidade_id IN (SELECT get_user_unidades(auth.uid()))));

-- ---------- rotina_atividades (incl. DELETE auth.uid() guard) ----------
DROP POLICY IF EXISTS delete_rotina_atividades ON public.rotina_atividades;
DROP POLICY IF EXISTS insert_rotina_atividades ON public.rotina_atividades;
DROP POLICY IF EXISTS select_rotina_atividades ON public.rotina_atividades;
DROP POLICY IF EXISTS update_rotina_atividades ON public.rotina_atividades;

CREATE POLICY select_rotina_atividades ON public.rotina_atividades
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.rotinas r
    WHERE r.id = rotina_atividades.rotina_id
      AND (has_role(auth.uid(),'admin'::app_role) OR r.unidade_id IN (SELECT get_user_unidades(auth.uid())))
  ));
CREATE POLICY insert_rotina_atividades ON public.rotina_atividades
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.rotinas r
    WHERE r.id = rotina_atividades.rotina_id
      AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'coordenador'::app_role) OR r.unidade_id IN (SELECT get_user_unidades(auth.uid())))
  ));
CREATE POLICY update_rotina_atividades ON public.rotina_atividades
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.rotinas r
    WHERE r.id = rotina_atividades.rotina_id
      AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'coordenador'::app_role) OR r.unidade_id IN (SELECT get_user_unidades(auth.uid())))
  ));
CREATE POLICY delete_rotina_atividades ON public.rotina_atividades
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.rotinas r
    WHERE r.id = rotina_atividades.rotina_id
      AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'coordenador'::app_role))
  ));

-- ---------- task_comments ----------
DROP POLICY IF EXISTS delete_task_comments_own_or_admin ON public.task_comments;
DROP POLICY IF EXISTS insert_task_comments_by_task_unidade ON public.task_comments;
DROP POLICY IF EXISTS select_task_comments_by_task_unidade ON public.task_comments;

CREATE POLICY select_task_comments_by_task_unidade ON public.task_comments
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND (has_role(auth.uid(),'admin'::app_role) OR t.unidade_id IN (SELECT get_user_unidades(auth.uid())))
  ));
CREATE POLICY insert_task_comments_by_task_unidade ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND (has_role(auth.uid(),'admin'::app_role) OR t.unidade_id IN (SELECT get_user_unidades(auth.uid())))
  ));
CREATE POLICY delete_task_comments_own_or_admin ON public.task_comments
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role)));

-- ---------- task_subtasks ----------
DROP POLICY IF EXISTS delete_task_subtasks_by_task_unidade ON public.task_subtasks;
DROP POLICY IF EXISTS insert_task_subtasks_by_task_unidade ON public.task_subtasks;
DROP POLICY IF EXISTS select_task_subtasks_by_task_unidade ON public.task_subtasks;
DROP POLICY IF EXISTS update_task_subtasks_by_task_unidade ON public.task_subtasks;

CREATE POLICY select_task_subtasks_by_task_unidade ON public.task_subtasks
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_subtasks.task_id
      AND (has_role(auth.uid(),'admin'::app_role) OR t.unidade_id IN (SELECT get_user_unidades(auth.uid())))
  ));
CREATE POLICY insert_task_subtasks_by_task_unidade ON public.task_subtasks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_subtasks.task_id
      AND (has_role(auth.uid(),'admin'::app_role) OR t.unidade_id IN (SELECT get_user_unidades(auth.uid())))
  ));
CREATE POLICY update_task_subtasks_by_task_unidade ON public.task_subtasks
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_subtasks.task_id
      AND (has_role(auth.uid(),'admin'::app_role) OR t.unidade_id IN (SELECT get_user_unidades(auth.uid())))
  ));
CREATE POLICY delete_task_subtasks_by_task_unidade ON public.task_subtasks
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_subtasks.task_id
      AND (has_role(auth.uid(),'admin'::app_role) OR t.unidade_id IN (SELECT get_user_unidades(auth.uid())))
  ));

-- ---------- resumo_semanal_pendentes: explicit deny for clients ----------
-- Already had only an admin SELECT policy; INSERT/UPDATE/DELETE were implicitly denied
-- to all client roles. Adding explicit restrictive deny policies for clarity.
-- service_role bypasses RLS, so backend ingestion continues to work.
CREATE POLICY deny_insert_resumo_pendentes_clients ON public.resumo_semanal_pendentes
  AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY deny_update_resumo_pendentes_clients ON public.resumo_semanal_pendentes
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false);
CREATE POLICY deny_delete_resumo_pendentes_clients ON public.resumo_semanal_pendentes
  AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);
