#!/usr/bin/env bash
# Ensaio isolado (banco local descartável, sem integrações). Não toca produção.
set -euo pipefail
DIR="$(dirname "$(realpath "$0")")"; T=/tmp/fase5-sec
rm -rf "$T"; mkdir -p "$T/s"; chown -R 1000:1000 "$T"
R="setpriv --reuid=1000 --regid=1000 --clear-groups"
$R initdb -D "$T/d" -A trust -U lovable >/dev/null
$R pg_ctl -D "$T/d" -l "$T/log" -o "-k $T/s -p 55451 -c listen_addresses=" -w start >/dev/null
trap '$R pg_ctl -D "$T/d" -m fast stop >/dev/null' EXIT
P=(env -u PGHOST -u PGPORT -u PGUSER -u PGPASSWORD -u PGDATABASE psql -h "$T/s" -p 55451 -U lovable -d postgres -X -q -v ON_ERROR_STOP=1)
"${P[@]}" <<'SQL'
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}');
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
CREATE TYPE app_role AS ENUM ('admin','moderator','user','coordenador','gerente');
CREATE TABLE user_roles(user_id uuid, role app_role);
CREATE TABLE user_unidades(user_id uuid, unidade_id uuid);
CREATE FUNCTION has_role(_user_id uuid,_role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_user_id AND role=_role)$$;
CREATE FUNCTION get_user_unidades(_user_id uuid) RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$SELECT unidade_id FROM user_unidades WHERE user_id=_user_id$$;
CREATE TABLE app_config(chave text PRIMARY KEY, valor text); INSERT INTO app_config VALUES('cron_secret','x');
CREATE TABLE leads(id uuid PRIMARY KEY, ativo boolean DEFAULT true, updated_at timestamptz, origem text, cadastrado_por text, status_funil text, data_aula_experimental timestamptz, unidade_id uuid, created_at timestamptz DEFAULT now());
CREATE TABLE interacoes(lead_id uuid, cadastrado_por text, treinador_responsavel text, treinador_experimental text, data_interacao timestamptz, compareceu boolean, tipo text);
CREATE TABLE follow_ups(lead_id uuid, unidade_id uuid, tipo text, data_referencia timestamptz, data_prevista timestamptz, UNIQUE(lead_id,tipo));
CREATE TABLE user_profiles(user_id uuid, telefone text);
CREATE TABLE whatsapp_idempotencia(chave text PRIMARY KEY, funcao text, destino text, canal text, expires_at timestamptz);
CREATE TABLE contas_pagar(id uuid PRIMARY KEY, unidade_id uuid);
CREATE TABLE contas_pagar_envios(id uuid DEFAULT gen_random_uuid(), conta_id uuid, unidade_id uuid, tipo_envio text, status text, proxima_tentativa_em timestamptz, tentativas int DEFAULT 0, UNIQUE(conta_id,tipo_envio));
CREATE TABLE tasks(id uuid PRIMARY KEY, unidade_id uuid, titulo text);
CREATE TABLE task_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid, user_id uuid, user_name text, campo text, valor_anterior text, valor_novo text, created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT ON task_history TO authenticated; GRANT ALL ON task_history TO service_role;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY insert_task_history_system ON task_history FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);
-- trigger interno equivalente a log_task_changes (SECURITY DEFINER do proprietário)
CREATE FUNCTION log_task_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN INSERT INTO task_history(task_id,user_id,campo,valor_novo) VALUES(NEW.id,auth.uid(),'titulo',NEW.titulo); RETURN NEW; END $$;
CREATE TRIGGER t AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION log_task_changes();
GRANT SELECT, UPDATE ON tasks TO authenticated;
SQL
# corpos atuais de produção (cópia de leitura)
sed '/^-- Privilégios/,$d' "$DIR/originais.sql" | sed 's/^-- Definições.*//' | "${P[@]}" >/dev/null
# função interna chamadora (como notify_*_http): SECURITY DEFINER
"${P[@]}" -c "CREATE FUNCTION interno_le_segredo() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public AS \$\$SELECT public.get_cron_secret()\$\$; GRANT EXECUTE ON FUNCTION interno_le_segredo() TO authenticated;"
# estado antes: provar vulnerabilidades
"${P[@]}" -At <<'SQL' > "$T/antes.txt"
INSERT INTO user_roles VALUES('11111111-0000-0000-0000-000000000001','admin'),('22222222-0000-0000-0000-000000000002','moderator');
INSERT INTO user_unidades VALUES('22222222-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-00000000000a');
INSERT INTO tasks VALUES('bbbbbbbb-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-00000000000c','x'),('aaaaaaaa-0000-0000-0000-0000000000a1','aaaaaaaa-0000-0000-0000-00000000000a','y');
INSERT INTO leads(id,origem) VALUES('dddddddd-0000-0000-0000-00000000000d','TESTE');
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','22222222-0000-0000-0000-000000000002',false);
SELECT 'antes_segredo_lido:'||(get_cron_secret() IS NOT NULL);
SELECT 'antes_admin_fn:'||admin_standardize_origem('TESTE','Y');
INSERT INTO task_history(task_id,user_id,user_name) VALUES('bbbbbbbb-0000-0000-0000-00000000000b','11111111-0000-0000-0000-000000000001','FALSO');
SELECT 'antes_forjado_outra_unidade:ok';
RESET ROLE;
SQL
cat "$T/antes.txt"
# aplicar candidato
"${P[@]}" < "$DIR/correcoes.candidate.sql" >/dev/null
"${P[@]}" < "$DIR/apply-guards.sql" >/dev/null
python3 "$DIR/assert_after.py" "$T/s"
