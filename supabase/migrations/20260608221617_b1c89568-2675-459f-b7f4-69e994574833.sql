-- Step 1: Audit and clean up existing insecure policies
DROP POLICY IF EXISTS "Admins full access" ON public.profile_admin_notes;
DROP POLICY IF EXISTS "Coordinators read access" ON public.profile_admin_notes;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.profile_admin_notes ENABLE ROW LEVEL SECURITY;

-- Step 3: Create SELECT policy scoped by unit or admin role
CREATE POLICY "select_profile_admin_notes_scoped"
ON public.profile_admin_notes
FOR SELECT
TO authenticated
USING (
    auth.uid() IS NOT NULL
    AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR (
            public.has_role(auth.uid(), 'coordenador'::app_role)
            AND EXISTS (
                SELECT 1 FROM public.user_unidades target_uu
                WHERE target_uu.user_id = profile_admin_notes.profile_id
                AND target_uu.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
            )
        )
    )
);

-- Step 4: Create INSERT policy scoped by unit or admin role
CREATE POLICY "insert_profile_admin_notes_scoped"
ON public.profile_admin_notes
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR (
            public.has_role(auth.uid(), 'coordenador'::app_role)
            AND EXISTS (
                SELECT 1 FROM public.user_unidades target_uu
                WHERE target_uu.user_id = profile_admin_notes.profile_id
                AND target_uu.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
            )
        )
    )
);

-- Step 5: Create UPDATE policy scoped by unit or admin role
CREATE POLICY "update_profile_admin_notes_scoped"
ON public.profile_admin_notes
FOR UPDATE
TO authenticated
USING (
    auth.uid() IS NOT NULL
    AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR (
            public.has_role(auth.uid(), 'coordenador'::app_role)
            AND EXISTS (
                SELECT 1 FROM public.user_unidades target_uu
                WHERE target_uu.user_id = profile_admin_notes.profile_id
                AND target_uu.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
            )
        )
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR (
            public.has_role(auth.uid(), 'coordenador'::app_role)
            AND EXISTS (
                SELECT 1 FROM public.user_unidades target_uu
                WHERE target_uu.user_id = profile_admin_notes.profile_id
                AND target_uu.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))
            )
        )
    )
);

-- Step 6: Create DELETE policy restricted to admins only
CREATE POLICY "delete_profile_admin_notes_admin"
ON public.profile_admin_notes
FOR DELETE
TO authenticated
USING (
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'admin'::app_role)
);