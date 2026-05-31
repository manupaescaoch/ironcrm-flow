-- Tabela principal de reuniões
CREATE TABLE public.reunioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL,
  tipo text NOT NULL,
  data date NOT NULL,
  participantes text[] NOT NULL DEFAULT '{}',
  numeros_periodo jsonb NOT NULL DEFAULT '{}'::jsonb,
  pauta text,
  decisoes text,
  resumo text,
  status text NOT NULL DEFAULT 'aberta',
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reunioes TO authenticated;
GRANT ALL ON public.reunioes TO service_role;

ALTER TABLE public.reunioes ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_reunioes_by_unidade ON public.reunioes
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);

CREATE POLICY insert_reunioes_admin_coord ON public.reunioes
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);

CREATE POLICY update_reunioes_admin_coord ON public.reunioes
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);

CREATE POLICY delete_reunioes_admin_coord ON public.reunioes
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);

CREATE TRIGGER reunioes_set_updated_at
BEFORE UPDATE ON public.reunioes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_reunioes_unidade ON public.reunioes(unidade_id);
CREATE INDEX idx_reunioes_data ON public.reunioes(data DESC);

-- Tabela de encaminhamentos
CREATE TABLE public.reunioes_encaminhamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id uuid NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL,
  acao text NOT NULL,
  responsavel_id uuid,
  responsavel_nome text,
  prazo date,
  status text NOT NULL DEFAULT 'aberto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reunioes_encaminhamentos TO authenticated;
GRANT ALL ON public.reunioes_encaminhamentos TO service_role;

ALTER TABLE public.reunioes_encaminhamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_encaminhamentos_by_unidade ON public.reunioes_encaminhamentos
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);

CREATE POLICY insert_encaminhamentos_admin_coord ON public.reunioes_encaminhamentos
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);

CREATE POLICY update_encaminhamentos_admin_coord ON public.reunioes_encaminhamentos
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);

CREATE POLICY delete_encaminhamentos_admin_coord ON public.reunioes_encaminhamentos
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND unidade_id IN (SELECT get_user_unidades(auth.uid())))
  )
);

CREATE TRIGGER encaminhamentos_set_updated_at
BEFORE UPDATE ON public.reunioes_encaminhamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para sincronizar unidade_id do encaminhamento com a reunião
CREATE OR REPLACE FUNCTION public.sync_encaminhamento_unidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unidade uuid;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.reunioes WHERE id = NEW.reuniao_id;
  IF v_unidade IS NOT NULL THEN
    NEW.unidade_id := v_unidade;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER encaminhamentos_sync_unidade
BEFORE INSERT OR UPDATE ON public.reunioes_encaminhamentos
FOR EACH ROW EXECUTE FUNCTION public.sync_encaminhamento_unidade();

CREATE INDEX idx_encaminhamentos_reuniao ON public.reunioes_encaminhamentos(reuniao_id);
CREATE INDEX idx_encaminhamentos_unidade ON public.reunioes_encaminhamentos(unidade_id);
CREATE INDEX idx_encaminhamentos_status ON public.reunioes_encaminhamentos(status);