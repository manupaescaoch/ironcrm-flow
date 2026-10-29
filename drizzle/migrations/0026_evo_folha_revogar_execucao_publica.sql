-- Correção da revisão (28/10/2026): funções de permissão da folha recebiam EXECUTE de PUBLIC/anon
-- por padrão do PostgreSQL. Visitantes sem login poderiam consultar permissões de qualquer usuário.
-- Mantém acesso de usuários logados (necessário às políticas de leitura) e do servidor.
REVOKE EXECUTE ON FUNCTION public.folha_pode(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.folha_pode_global(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.folha_minhas_permissoes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.folha_pode(uuid,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.folha_pode_global(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.folha_minhas_permissoes(uuid) TO authenticated, service_role;