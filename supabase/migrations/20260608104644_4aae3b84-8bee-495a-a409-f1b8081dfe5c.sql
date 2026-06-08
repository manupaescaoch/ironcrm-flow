-- Ensure RLS is enabled
ALTER TABLE public.profile_admin_notes ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage all profile notes" ON public.profile_admin_notes;
DROP POLICY IF EXISTS "Coordinators can view profile notes" ON public.profile_admin_notes;

-- Create strict policy for Admins (Full Control)
CREATE POLICY "Admins full access"
ON public.profile_admin_notes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create strict policy for Coordinators (Read Only)
CREATE POLICY "Coordinators read access"
ON public.profile_admin_notes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'coordenador'));

-- Standard users have no policies, meaning they are blocked by default (fail-closed)