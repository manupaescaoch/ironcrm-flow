-- Adicionar unidade_id às tabelas com DEFAULT = ZN (evita UPDATE que aciona trigger)
-- ZN ID: b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6

-- 1. Leads
ALTER TABLE public.leads 
ADD COLUMN unidade_id uuid NOT NULL DEFAULT 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6'::uuid 
REFERENCES public.unidades(id);

-- 2. Interacoes
ALTER TABLE public.interacoes 
ADD COLUMN unidade_id uuid NOT NULL DEFAULT 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6'::uuid 
REFERENCES public.unidades(id);

-- 3. Movimentacoes estoque
ALTER TABLE public.movimentacoes_estoque 
ADD COLUMN unidade_id uuid NOT NULL DEFAULT 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6'::uuid 
REFERENCES public.unidades(id);

-- 4. Estoque interno
ALTER TABLE public.estoque_interno 
ADD COLUMN unidade_id uuid NOT NULL DEFAULT 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6'::uuid 
REFERENCES public.unidades(id);

-- 5. Insumos (pode ser compartilhado entre unidades, mas por padrão será ZN)
ALTER TABLE public.insumos 
ADD COLUMN unidade_id uuid DEFAULT 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6'::uuid 
REFERENCES public.unidades(id);

-- 6. Relatorio gerencial (renomear tabela existente para ZN e depois criar estrutura multi-unidade)
ALTER TABLE public.relatorio_gerencial_zn 
ADD COLUMN unidade_id uuid NOT NULL DEFAULT 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6'::uuid 
REFERENCES public.unidades(id);

-- Criar índices para performance
CREATE INDEX idx_leads_unidade_id ON public.leads(unidade_id);
CREATE INDEX idx_interacoes_unidade_id ON public.interacoes(unidade_id);
CREATE INDEX idx_estoque_interno_unidade_id ON public.estoque_interno(unidade_id);
CREATE INDEX idx_movimentacoes_estoque_unidade_id ON public.movimentacoes_estoque(unidade_id);
CREATE INDEX idx_user_unidades_user_id ON public.user_unidades(user_id);
CREATE INDEX idx_user_unidades_unidade_id ON public.user_unidades(unidade_id);
CREATE INDEX idx_relatorio_gerencial_unidade_id ON public.relatorio_gerencial_zn(unidade_id);