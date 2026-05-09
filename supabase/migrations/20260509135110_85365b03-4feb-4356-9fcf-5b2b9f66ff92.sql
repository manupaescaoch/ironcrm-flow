
CREATE TABLE public.anamneses_experimental (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL UNIQUE,
  unidade_id uuid NOT NULL,
  nome text,
  objetivo text,
  historico text,
  frequencia_atual text,
  obstaculo text,
  dias_semana text,
  preferencia_horario text[] DEFAULT '{}'::text[],
  tem_condicao_saude boolean,
  condicao_saude_descricao text,
  tem_lesao boolean,
  lesao_descricao text,
  observacoes text,
  preenchido_por uuid DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.anamneses_experimental ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_anamneses_by_unidade
ON public.anamneses_experimental FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY insert_anamneses_by_unidade
ON public.anamneses_experimental FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY update_anamneses_by_unidade
ON public.anamneses_experimental FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR unidade_id IN (SELECT get_user_unidades(auth.uid()))
  )
);

CREATE POLICY delete_anamneses_admin
ON public.anamneses_experimental FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_anamneses_experimental_updated_at
BEFORE UPDATE ON public.anamneses_experimental
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
