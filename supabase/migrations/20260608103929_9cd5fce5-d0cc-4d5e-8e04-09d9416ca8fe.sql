-- Create the new table for admin notes
CREATE TABLE public.profile_admin_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_admin_notes TO authenticated;
GRANT ALL ON public.profile_admin_notes TO service_role;

-- Enable RLS
ALTER TABLE public.profile_admin_notes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all profile notes"
ON public.profile_admin_notes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coordinators can view profile notes"
ON public.profile_admin_notes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'coordenador'));

-- Migration of existing data
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'admin_notes') THEN
        INSERT INTO public.profile_admin_notes (profile_id, notes)
        SELECT user_id, admin_notes
        FROM public.user_profiles
        WHERE admin_notes IS NOT NULL AND admin_notes != '';
        
        -- Remove the column from user_profiles
        ALTER TABLE public.user_profiles DROP COLUMN admin_notes;
    END IF;
END $$;

-- Trigger for updated_at
CREATE TRIGGER update_profile_admin_notes_updated_at
BEFORE UPDATE ON public.profile_admin_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();