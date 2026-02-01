-- =============================================
-- FASE 1: TABELA DE FORNECEDORES
-- =============================================

-- Criar tabela de fornecedores
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  lead_time_dias integer NOT NULL DEFAULT 3,
  telefone text,
  email text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comentário na tabela
COMMENT ON TABLE public.fornecedores IS 'Cadastro centralizado de fornecedores por unidade com lead time padrão';

-- Habilitar RLS
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

-- Policies para fornecedores (baseadas em unidade do usuário)
CREATE POLICY "Usuarios podem ver fornecedores de suas unidades"
ON public.fornecedores FOR SELECT
USING (public.user_has_unidade_access(auth.uid(), unidade_id));

CREATE POLICY "Usuarios podem inserir fornecedores em suas unidades"
ON public.fornecedores FOR INSERT
WITH CHECK (public.user_has_unidade_access(auth.uid(), unidade_id));

CREATE POLICY "Usuarios podem atualizar fornecedores de suas unidades"
ON public.fornecedores FOR UPDATE
USING (public.user_has_unidade_access(auth.uid(), unidade_id));

CREATE POLICY "Usuarios podem deletar fornecedores de suas unidades"
ON public.fornecedores FOR DELETE
USING (public.user_has_unidade_access(auth.uid(), unidade_id));

-- Índice para performance
CREATE INDEX idx_fornecedores_unidade ON public.fornecedores(unidade_id);
CREATE INDEX idx_fornecedores_nome ON public.fornecedores(nome);

-- Trigger para updated_at
CREATE TRIGGER update_fornecedores_updated_at
BEFORE UPDATE ON public.fornecedores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FASE 2: NOVOS CAMPOS EM INSUMOS
-- =============================================

-- Campo para média diária manual
ALTER TABLE public.insumos ADD COLUMN media_diaria_manual numeric;

-- Campo para indicar se deve usar média manual
ALTER TABLE public.insumos ADD COLUMN usar_media_manual boolean NOT NULL DEFAULT false;

-- FK para tabela de fornecedores (opcional, mantém compatibilidade com fornecedor_padrao texto)
ALTER TABLE public.insumos ADD COLUMN fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

-- Índice para FK
CREATE INDEX idx_insumos_fornecedor_id ON public.insumos(fornecedor_id);

-- Comentários nos novos campos
COMMENT ON COLUMN public.insumos.media_diaria_manual IS 'Média diária de consumo definida manualmente (para produtos novos ou sazonais)';
COMMENT ON COLUMN public.insumos.usar_media_manual IS 'Se true, usa media_diaria_manual em vez do cálculo automático baseado em retiradas';
COMMENT ON COLUMN public.insumos.fornecedor_id IS 'FK para tabela fornecedores, permite herdar lead_time automaticamente';