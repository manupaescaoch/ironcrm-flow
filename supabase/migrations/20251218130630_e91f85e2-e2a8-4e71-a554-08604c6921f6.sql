-- Atualizar constraint de categorias
ALTER TABLE public.insumos DROP CONSTRAINT IF EXISTS insumos_categoria_check;
ALTER TABLE public.insumos ADD CONSTRAINT insumos_categoria_check 
  CHECK (categoria IN ('Copa e Recepção', 'Suplementos (uso interno)', 'Limpeza', 'Descartáveis', 'Higiene Pessoal'));