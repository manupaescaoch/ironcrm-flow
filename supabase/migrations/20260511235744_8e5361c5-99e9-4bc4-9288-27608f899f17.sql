-- Remove user_profiles from realtime publication (no frontend usage detected)
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_profiles;