-- 1. Helper RLS functions
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_unidades(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.user_has_unidade_access(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_role(uuid) SET search_path = public, pg_temp;

-- 2. Storage Helpers
ALTER FUNCTION public.user_can_access_rotina_comprovante_by_unidade(uuid, text) SET search_path = public, storage, pg_temp;
ALTER FUNCTION public.user_can_access_reuniao_anexo(uuid, text) SET search_path = public, storage, pg_temp;
ALTER FUNCTION public.user_can_insert_rotina_comprovante(uuid, text) SET search_path = public, storage, pg_temp;

-- 3. Trigger Functions (Generic)
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_whatsapp_conversations_updated_at() SET search_path = public, pg_temp;

-- 4. Business Logic Triggers & Functions
ALTER FUNCTION public.uppercase_cadastrado_atendido() SET search_path = public, pg_temp;
ALTER FUNCTION public.cancel_follow_ups_on_status_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_lead_status_on_matricula() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_lead_telefone_normalizado() SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_hora_experimental() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_hora_experimental_from_lead() SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_standardize_origem(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_standardize_treinador(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_duplicate_matricula() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_duplicate_lead() SET search_path = public, pg_temp;
ALTER FUNCTION public.normalize_phone(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_follow_ups_on_attendance() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_follow_up_unidade_from_lead() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_interacoes_hora_from_lead() SET search_path = public, pg_temp;
ALTER FUNCTION public.cancel_follow_ups_on_matricula() SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_plano_escolhido() SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_status_funil() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_interacao_unidade_from_lead() SET search_path = public, pg_temp;
ALTER FUNCTION public.atualizar_estoque_apos_movimentacao() SET search_path = public, pg_temp;
ALTER FUNCTION public.log_task_changes() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_phone_by_name(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_update_cadastrador(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.inativar_aluno(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_cleanup_duplicate_leads(uuid[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_status_avaliacao() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_lead_matriculado_status() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_leads_update_permissions() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_follow_ups_for_lead(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_cron_secret() SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_task_notification_flags() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_encaminhamento_unidade() SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_confirmacao_experimental_flags() SET search_path = public, pg_temp;
ALTER FUNCTION public.cancel_follow_ups_on_reschedule() SET search_path = public, pg_temp;
ALTER FUNCTION public.cancel_follow_ups_on_compareceu_undone() SET search_path = public, pg_temp;
