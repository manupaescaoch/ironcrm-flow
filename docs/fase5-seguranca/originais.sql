-- Definições originais (reversão)
CREATE OR REPLACE FUNCTION public.admin_cleanup_duplicate_leads(lead_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$

;
CREATE OR REPLACE FUNCTION public.admin_standardize_origem(old_value text, new_value text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$

;
CREATE OR REPLACE FUNCTION public.admin_standardize_treinador(old_value text, new_value text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$

;
CREATE OR REPLACE FUNCTION public.admin_update_cadastrador(old_name text, new_name text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$

;
CREATE OR REPLACE FUNCTION public.claim_whatsapp_envio(p_chave text, p_funcao text, p_destino text DEFAULT NULL::text, p_canal text DEFAULT NULL::text, p_ttl_minutes integer DEFAULT 43200)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

;
CREATE OR REPLACE FUNCTION public.generate_follow_ups_for_lead(p_lead_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$

;
CREATE OR REPLACE FUNCTION public.get_cron_secret()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

;
CREATE OR REPLACE FUNCTION public.get_user_phone_by_name(p_name text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$

;
CREATE OR REPLACE FUNCTION public.release_whatsapp_envio(p_chave text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

;
CREATE OR REPLACE FUNCTION public.reservar_envio_conta(p_conta_id uuid, p_tipo text)
 RETURNS contas_pagar_envios
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
;
-- Privilégios originais: EXECUTE para PUBLIC/anon/authenticated nas 10 funções;
-- política original de task_history:
-- CREATE POLICY insert_task_history_system ON public.task_history FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);
