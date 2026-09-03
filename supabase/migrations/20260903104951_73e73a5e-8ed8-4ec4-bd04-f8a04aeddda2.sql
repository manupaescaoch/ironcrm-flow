REVOKE ALL ON FUNCTION public.log_cronograma_atividade_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_cronograma_criado_por() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_cronograma_atividade() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_ops_execucao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_ops_execucao_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ops_can_access_atividade(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ops_can_execute_atividade(uuid, uuid) FROM anon;