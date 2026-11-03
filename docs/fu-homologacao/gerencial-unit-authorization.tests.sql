-- Run after homologacao-gerencial.tests.sql in a disposable local database only.
-- Concrete rule: a linked manager without the task's unit cannot confirm sending.
INSERT INTO user_roles VALUES ('00000000-0000-0000-0000-000000000090','gerente');
INSERT INTO telegram_users VALUES ('00000000-0000-0000-0000-000000000090',190,'conectado','OUTRA','UNIDADE');
INSERT INTO test_units VALUES ('00000000-0000-0000-0000-000000000090','00000000-0000-0000-0000-000000000099');
DO $$ DECLARE t uuid; BEGIN
 SELECT id INTO t FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000201' AND fu_gerencial_etapa='M+30';
 IF t IS NULL THEN RAISE EXCEPTION 'Required M+30 fixture missing'; END IF;
 UPDATE tasks SET fu_gerencial_telegram_chat_id=-123,fu_gerencial_telegram_message_id=300 WHERE id=t;
 IF (fu_gerencial_confirmar_envio(t,190,-123,300)->>'ok')::boolean THEN RAISE EXCEPTION 'Manager from another unit confirmed'; END IF;
 IF (SELECT fu_gerencial_confirmado_em FROM tasks WHERE id=t) IS NOT NULL THEN RAISE EXCEPTION 'Unauthorized confirmation persisted'; END IF;
END $$;
SELECT 'Cross-unit manager confirmation rejected' AS result;