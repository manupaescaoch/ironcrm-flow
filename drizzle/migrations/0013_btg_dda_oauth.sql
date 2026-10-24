CREATE TABLE public.btg_dda_conexoes (
 unidade_id uuid PRIMARY KEY REFERENCES public.unidades(id),
 cnpj text NOT NULL,
 tokens_cifrados text,
 conectado_em timestamptz,
 ultima_consulta_em timestamptz,
 ultimo_erro text,
 atualizado_por uuid,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.btg_dda_conexoes TO service_role;
ALTER TABLE public.btg_dda_conexoes ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.btg_dda_oauth_estados (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 state_hash text NOT NULL UNIQUE,
 unidade_id uuid NOT NULL REFERENCES public.unidades(id),
 cnpj text NOT NULL,
 user_id uuid NOT NULL,
 expira_em timestamptz NOT NULL,
 consumido_em timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.btg_dda_oauth_estados TO service_role;
ALTER TABLE public.btg_dda_oauth_estados ENABLE ROW LEVEL SECURITY;
CREATE INDEX btg_dda_oauth_expira ON public.btg_dda_oauth_estados(expira_em);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS btg_dda_id text;
CREATE UNIQUE INDEX contas_pagar_btg_dda_id ON public.contas_pagar(unidade_id,btg_dda_id) WHERE btg_dda_id IS NOT NULL;
COMMENT ON TABLE public.btg_dda_conexoes IS 'Server-only encrypted BTG consent tokens; never expose via browser reads.';