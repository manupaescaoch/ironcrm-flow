-- 1. Criar tabela de unidades
CREATE TABLE public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Inserir as duas unidades
INSERT INTO public.unidades (nome, slug) VALUES 
  ('Iron Zona Norte', 'zn'),
  ('Iron Zona Sul', 'zs');

-- Enable RLS
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

-- Política: todos autenticados podem ver unidades
CREATE POLICY "Authenticated can view unidades"
ON public.unidades FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2. Criar tabela de relacionamento usuário-unidades
CREATE TABLE public.user_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, unidade_id)
);

-- Enable RLS
ALTER TABLE public.user_unidades ENABLE ROW LEVEL SECURITY;

-- Políticas para user_unidades
CREATE POLICY "Users can view own unidades"
ON public.user_unidades FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage user_unidades"
ON public.user_unidades FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Criar função para verificar se usuário tem acesso à unidade
CREATE OR REPLACE FUNCTION public.user_has_unidade_access(_user_id uuid, _unidade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_unidades
    WHERE user_id = _user_id
      AND unidade_id = _unidade_id
  ) OR public.has_role(_user_id, 'admin'::app_role)
$$;

-- 4. Criar função para obter unidades do usuário
CREATE OR REPLACE FUNCTION public.get_user_unidades(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unidade_id
  FROM public.user_unidades
  WHERE user_id = _user_id
$$;