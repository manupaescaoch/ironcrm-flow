-- Compatibilidade do banco descartável com os testes de follow-up.
-- Somente ambiente isolado; nunca produção. Recria tabelas do bootstrap com a
-- ordem de colunas esperada pelos inserts posicionais dos testes e adiciona as
-- tabelas auxiliares usadas pelas funções de contexto.
BEGIN;

DROP TABLE IF EXISTS interacoes CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS telegram_groups CASCADE;

CREATE TABLE leads(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 nome text DEFAULT 'FIXTURE',
 unidade_id uuid REFERENCES unidades,
 ativo boolean DEFAULT true,
 is_matriculado boolean DEFAULT false,
 status_funil text DEFAULT 'aula_agendada',
 telefone text,
 origem text,
 pausado_fu boolean DEFAULT false,
 hora_aula_experimental time,
 data_aula_experimental timestamptz,
 updated_at timestamptz DEFAULT now()
);

CREATE TABLE interacoes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lead_id uuid NOT NULL REFERENCES leads ON DELETE CASCADE,
 fechou_matricula boolean DEFAULT false,
 data_fechamento date,
 cancelado boolean DEFAULT false,
 created_at timestamptz DEFAULT now(),
 unidade_id uuid REFERENCES unidades,
 tipo text NOT NULL DEFAULT 'Agendamento Experimental',
 created_by uuid,
 data_interacao timestamptz DEFAULT now(),
 descricao text,
 cadastrado_por text,
 atendido_por text,
 agendou_experimental boolean DEFAULT false,
 data_experimental date,
 hora_experimental time,
 compareceu boolean DEFAULT false,
 compareceu_em timestamptz,
 cancelado_em timestamptz,
 motivo_cancelamento text,
 reagendou boolean DEFAULT false,
 confirmado boolean DEFAULT false,
 status_avaliacao text,
 contato_meta jsonb,
 treinador_experimental text,
 boas_vindas_enviada_em timestamptz
);

CREATE TABLE telegram_groups(
 unidade_id uuid,
 group_type text,
 status text,
 telegram_chat_id bigint,
 id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE test_units(user_id uuid, unidade_id uuid);
CREATE OR REPLACE FUNCTION get_user_unidades(uuid) RETURNS SETOF uuid LANGUAGE sql STABLE AS $$ SELECT unidade_id FROM test_units WHERE user_id=$1 $$;

CREATE TABLE telegram_users(
 user_id uuid,
 telegram_user_id bigint,
 status text,
 telegram_first_name text,
 telegram_last_name text
);

CREATE TABLE task_history(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid,
 user_id uuid,
 user_name text,
 campo text,
 valor_anterior text,
 valor_novo text,
 created_at timestamptz DEFAULT now()
);

CREATE TABLE whatsapp_envios_log(
 unidade_id uuid,
 tipo_destino text,
 sucesso boolean,
 destino text,
 created_at timestamptz DEFAULT now()
);

CREATE TABLE whatsapp_messages(
 lead_id uuid,
 unidade_id uuid,
 direction text,
 received_at timestamptz DEFAULT now()
);

CREATE TABLE whatsapp_conversations(
 lead_id uuid,
 unidade_id uuid,
 status_conversa text
);

CREATE TABLE nps_respostas(
 lead_id uuid,
 unidade_id uuid,
 created_at timestamptz DEFAULT now(),
 nota_nps integer,
 status text
);

CREATE OR REPLACE FUNCTION canonical_phone(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT regexp_replace(coalesce($1,''),'\D','','g') $$;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recorrencia text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recorrencia_fim date;

COMMIT;
