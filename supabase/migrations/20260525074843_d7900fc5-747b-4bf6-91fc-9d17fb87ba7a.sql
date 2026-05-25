
-- ============================================================================
-- 1) Revogar EXECUTE de funções SECURITY DEFINER que NÃO devem ser chamadas
--    diretamente por authenticated/anon/PUBLIC.
--    (service_role mantém EXECUTE — usado pelas Edge Functions.)
--    (postgres/owner mantém EXECUTE — usado por triggers e migrações.)
-- ============================================================================

-- Funções administrativas — só devem ser chamadas via Edge Function com service_role
REVOKE EXECUTE ON FUNCTION public.admin_cleanup_duplicate_leads(uuid[])           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_standardize_origem(text, text)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_standardize_treinador(text, text)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_update_cadastrador(text, text)            FROM PUBLIC, anon, authenticated;

-- Utilitários internos — não usados em RLS, não chamados pelo frontend
REVOKE EXECUTE ON FUNCTION public.find_user_by_name(text)                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_phone_by_name(text)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid)                             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_follow_ups_for_lead(uuid)              FROM PUBLIC, anon, authenticated;

-- Funções de trigger — disparadas pelo banco, nunca chamadas via API
REVOKE EXECUTE ON FUNCTION public.atualizar_estoque_apos_movimentacao()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_follow_ups_on_compareceu_undone()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_follow_ups_on_matricula()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_follow_ups_on_reschedule()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_follow_ups_on_status_change()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_duplicate_lead()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_duplicate_matricula()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_leads_update_permissions()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_follow_ups_on_attendance()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_task_changes()                              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_task_assignment()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_confirmacao_experimental_flags()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_task_notification_flags()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_follow_up_unidade_from_lead()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_hora_experimental_from_lead()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_interacao_unidade_from_lead()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_interacoes_hora_from_lead()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_lead_matriculado_status()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_lead_status_on_matricula()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uppercase_cadastrado_atendido()                 FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 2) Funções que DEVEM permanecer executáveis por authenticated
--    (usadas em policies RLS ou chamadas via .rpc() pelo frontend autenticado).
--    anon continua revogado.
-- ============================================================================

-- has_role / get_user_unidades / user_has_unidade_access — usadas em policies RLS
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)                 FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)                 TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_unidades(uuid)                         FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_unidades(uuid)                         TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_has_unidade_access(uuid, uuid)             FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_unidade_access(uuid, uuid)             TO authenticated;

-- inativar_aluno — chamada via supabase.rpc() em VencimentosTable.tsx
-- A própria função já valida permissões (has_role + ownership/unit access).
REVOKE EXECUTE ON FUNCTION public.inativar_aluno(uuid)                            FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.inativar_aluno(uuid)                            TO authenticated;
