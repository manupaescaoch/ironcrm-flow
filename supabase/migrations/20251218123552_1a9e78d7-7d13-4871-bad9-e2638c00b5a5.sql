-- Corrigir erro: remover trigger dependente e então remover a função
DROP TRIGGER IF EXISTS trg_enforce_interacoes_update_permissions ON public.interacoes;
DROP FUNCTION IF EXISTS public.enforce_interacoes_update_permissions();