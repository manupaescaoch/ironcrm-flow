-- Tabela: INSUMOS (cadastro fixo)
CREATE TABLE public.insumos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_insumo TEXT NOT NULL UNIQUE,
  nome_insumo TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('Limpeza', 'Café', 'Suplementação Interna', 'Operacional', 'Administrativo')),
  unidade_medida TEXT NOT NULL CHECK (unidade_medida IN ('un', 'litro', 'kg', 'pacote', 'caixa')),
  quantidade_minima INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: ESTOQUE_INTERNO (estado atual)
CREATE TABLE public.estoque_interno (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  quantidade_atual INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(insumo_id)
);

-- Tabela: MOVIMENTACOES_ESTOQUE (entradas, retiradas, ajustes)
CREATE TABLE public.movimentacoes_estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'retirada', 'ajuste')),
  quantidade INTEGER NOT NULL,
  setor TEXT CHECK (setor IN ('Limpeza', 'Café', 'Treino', 'Administrativo')),
  responsavel TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID DEFAULT auth.uid()
);

-- Enable RLS
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_interno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

-- Policies para insumos
CREATE POLICY "Authenticated can view insumos" ON public.insumos FOR SELECT USING (true);
CREATE POLICY "Admin can manage insumos" ON public.insumos FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies para estoque_interno
CREATE POLICY "Authenticated can view estoque" ON public.estoque_interno FOR SELECT USING (true);
CREATE POLICY "Admin can manage estoque" ON public.estoque_interno FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies para movimentacoes
CREATE POLICY "Authenticated can view movimentacoes" ON public.movimentacoes_estoque FOR SELECT USING (true);
CREATE POLICY "Authenticated can create movimentacoes" ON public.movimentacoes_estoque FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can manage movimentacoes" ON public.movimentacoes_estoque FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_insumos_updated_at BEFORE UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_estoque_interno_updated_at BEFORE UPDATE ON public.estoque_interno FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar estoque automaticamente após movimentação
CREATE OR REPLACE FUNCTION public.atualizar_estoque_apos_movimentacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Verifica se já existe registro de estoque para o insumo
  IF NOT EXISTS (SELECT 1 FROM public.estoque_interno WHERE insumo_id = NEW.insumo_id) THEN
    INSERT INTO public.estoque_interno (insumo_id, quantidade_atual) VALUES (NEW.insumo_id, 0);
  END IF;

  -- Atualiza quantidade baseado no tipo
  IF NEW.tipo = 'entrada' THEN
    UPDATE public.estoque_interno SET quantidade_atual = quantidade_atual + NEW.quantidade, updated_at = now() WHERE insumo_id = NEW.insumo_id;
  ELSIF NEW.tipo = 'retirada' THEN
    UPDATE public.estoque_interno SET quantidade_atual = GREATEST(0, quantidade_atual - NEW.quantidade), updated_at = now() WHERE insumo_id = NEW.insumo_id;
  ELSIF NEW.tipo = 'ajuste' THEN
    UPDATE public.estoque_interno SET quantidade_atual = NEW.quantidade, updated_at = now() WHERE insumo_id = NEW.insumo_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_atualizar_estoque
AFTER INSERT ON public.movimentacoes_estoque
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_estoque_apos_movimentacao();