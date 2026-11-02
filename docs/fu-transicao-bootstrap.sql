-- Isolated fixtures only: use an explicitly local socket, never production.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE TABLE user_roles(user_id uuid,role text);
CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role=$2) $$;
CREATE TABLE user_unidades(user_id uuid,unidade_id uuid);
CREATE FUNCTION get_user_unidades(uuid) RETURNS SETOF uuid LANGUAGE sql STABLE AS $$ SELECT unidade_id FROM user_unidades WHERE user_id=$1 $$;
CREATE TABLE unidades(id uuid PRIMARY KEY,nome text);
CREATE TABLE leads(id uuid PRIMARY KEY,unidade_id uuid,ativo boolean,is_matriculado boolean,pausado_fu boolean,origem text);
CREATE TABLE interacoes(id uuid PRIMARY KEY,lead_id uuid,unidade_id uuid,tipo text,fechou_matricula boolean,cancelado boolean,data_fechamento date,data_interacao timestamptz,created_at timestamptz);
CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),unidade_id uuid,status text,fu_matriculados_lead_id uuid,fu_matriculados_matricula_id uuid,fu_matriculados_confirmado_em timestamptz,fu_matriculados_envio_erro text,
 fu_tecnico_lead_id uuid,fu_tecnico_matricula_id uuid,fu_tecnico_etapa text,fu_tecnico_status text,fu_tecnico_envio_erro text,
 fu_gerencial_lead_id uuid,fu_gerencial_matricula_id uuid,fu_gerencial_etapa text,fu_gerencial_status text,fu_gerencial_envio_erro text);
CREATE TABLE telegram_groups(unidade_id uuid,status text,group_type text);
CREATE TABLE follow_ups(id uuid PRIMARY KEY,lead_id uuid,unidade_id uuid,tipo text,status text,data_referencia timestamptz,CONSTRAINT follow_ups_lead_id_tipo_key UNIQUE(lead_id,tipo));