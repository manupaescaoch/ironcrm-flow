-- Adicionar coluna telefone aos user_metadata via função helper
-- Como não podemos modificar auth.users diretamente, criamos uma tabela auxiliar

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Usuário pode ver e editar seu próprio perfil
CREATE POLICY "Users can view own profile"
ON public.user_profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Admin pode ver todos
CREATE POLICY "Admin can view all profiles"
ON public.user_profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Índice para busca por telefone
CREATE INDEX idx_user_profiles_telefone ON public.user_profiles(telefone);

-- Trigger para updated_at
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para buscar telefone do usuário pelo nome (usado no trigger de tarefas)
CREATE OR REPLACE FUNCTION public.get_user_phone_by_name(p_name text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.telefone 
  FROM user_profiles up
  JOIN auth.users au ON au.id = up.user_id
  WHERE UPPER(COALESCE(au.raw_user_meta_data->>'name', '')) = UPPER(TRIM(p_name))
    AND up.telefone IS NOT NULL
    AND up.telefone != ''
  LIMIT 1
$$;

-- Habilitar realtime para user_profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;