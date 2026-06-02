-- Fix overly broad SELECT on rotina_notificacoes and tighten writes
ALTER TABLE public.rotina_notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_rotina_notificacoes_authenticated" ON public.rotina_notificacoes;
DROP POLICY IF EXISTS "insert_rotina_notificacoes_authenticated" ON public.rotina_notificacoes;

-- SELECT scoped by unidade through rotinas
CREATE POLICY "select_rotina_notificacoes_by_unidade"
ON public.rotina_notificacoes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.rotinas r
    WHERE r.id = rotina_notificacoes.rotina_id
      AND r.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

-- INSERT restricted: admin or users with access to the rotina's unidade
-- (Edge Functions using service_role bypass RLS automatically)
CREATE POLICY "insert_rotina_notificacoes_by_unidade"
ON public.rotina_notificacoes
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.rotinas r
    WHERE r.id = rotina_notificacoes.rotina_id
      AND r.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

-- UPDATE: admin or unidade members (e.g., marking status)
CREATE POLICY "update_rotina_notificacoes_by_unidade"
ON public.rotina_notificacoes
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.rotinas r
    WHERE r.id = rotina_notificacoes.rotina_id
      AND r.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.rotinas r
    WHERE r.id = rotina_notificacoes.rotina_id
      AND r.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
  )
);

-- DELETE: admin only
CREATE POLICY "delete_rotina_notificacoes_admin"
ON public.rotina_notificacoes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));