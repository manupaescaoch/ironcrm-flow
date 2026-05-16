-- Restaurar grants de INSERT para os formulários de encerramento (anon + authenticated)
-- As policies RLS existem mas faltam os GRANTs no nível da tabela
GRANT INSERT ON public.encerramento_turno_respostas TO anon, authenticated;
GRANT INSERT ON public.encerramento_horario_respostas TO anon, authenticated;
GRANT INSERT ON public.encerramento_coordenador_respostas TO anon, authenticated;
GRANT INSERT ON public.relatorio_diario_comercial_respostas TO anon, authenticated;
GRANT INSERT ON public.formulario_respostas TO anon, authenticated;

-- SELECT só para authenticated (admin via RLS)
GRANT SELECT ON public.encerramento_turno_respostas TO authenticated;
GRANT SELECT ON public.encerramento_horario_respostas TO authenticated;
GRANT SELECT ON public.encerramento_coordenador_respostas TO authenticated;
GRANT SELECT ON public.relatorio_diario_comercial_respostas TO authenticated;
GRANT SELECT ON public.formulario_respostas TO authenticated;