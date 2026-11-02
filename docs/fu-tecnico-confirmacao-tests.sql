-- Disposable fixture only. Run after the original isolated tests, never production.
SET test.uid='';
INSERT INTO telegram_users VALUES('00000000-0000-0000-0000-000000000030',123456,'conectado','ANA','TESTE');
INSERT INTO telegram_groups VALUES('00000000-0000-0000-0000-000000000011','coordenadores','conectado',-123456);
INSERT INTO test_units VALUES('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000011');
INSERT INTO unidades VALUES('00000000-0000-0000-0000-000000000011','UNIDADE FICTÍCIA');
INSERT INTO interacoes VALUES('00000000-0000-0000-0000-000000000024','00000000-0000-0000-0000-000000000001',true,'2026-11-02',false);
UPDATE tasks SET fu_tecnico_telegram_chat_id=-123456,fu_tecnico_telegram_message_id=100 WHERE fu_tecnico_matricula_id='00000000-0000-0000-0000-000000000024';
DO $$ DECLARE t uuid; r jsonb; n integer; BEGIN
 SELECT id INTO t FROM tasks WHERE fu_tecnico_matricula_id='00000000-0000-0000-0000-000000000024' AND fu_tecnico_etapa='M+7';
 IF (fu_tecnico_confirmar_envio(t,999999,-123456,100)->>'ok')::boolean THEN RAISE EXCEPTION 'Unlinked user accepted'; END IF;
 IF (fu_tecnico_confirmar_envio(t,123456,-222222,100)->>'ok')::boolean THEN RAISE EXCEPTION 'Other group accepted'; END IF;
 IF (fu_tecnico_confirmar_envio(t,123456,-123456,99)->>'ok')::boolean THEN RAISE EXCEPTION 'Old message accepted'; END IF;
 r:=fu_tecnico_confirmar_envio(t,123456,-123456,100);
 IF r->>'ok'<>'true' OR r->>'duplicado'<>'false' THEN RAISE EXCEPTION 'Confirmation failed: %',r; END IF;
 IF (SELECT fu_tecnico_status FROM tasks WHERE id=t)<>'pendente' THEN RAISE EXCEPTION 'Confirmation completed accompaniment'; END IF;
 IF (SELECT fu_tecnico_confirmado_por FROM tasks WHERE id=t)<>'00000000-0000-0000-0000-000000000030'::uuid THEN RAISE EXCEPTION 'Wrong user'; END IF;
 IF (SELECT fu_tecnico_confirmado_telegram_id FROM tasks WHERE id=t)<>123456 THEN RAISE EXCEPTION 'Missing Telegram identity'; END IF;
 IF (SELECT fu_tecnico_confirmado_em FROM tasks WHERE id=t) IS NULL THEN RAISE EXCEPTION 'Missing timestamp'; END IF;
 SELECT count(*) INTO n FROM task_history WHERE task_id=t AND campo='fu_tecnico_envio_aluno';
 r:=fu_tecnico_confirmar_envio(t,123456,-123456,100);
 IF r->>'duplicado'<>'true' OR (SELECT count(*) FROM task_history WHERE task_id=t AND campo='fu_tecnico_envio_aluno')<>n THEN RAISE EXCEPTION 'Duplicate confirmation changed audit'; END IF;
 IF fu_tecnico_claim(t,'2026-12-01') THEN RAISE EXCEPTION 'Confirmed send still reminded'; END IF;
 UPDATE tasks SET fu_tecnico_status='cancelado' WHERE fu_tecnico_matricula_id='00000000-0000-0000-0000-000000000024' AND fu_tecnico_etapa='M+21';
 SELECT id INTO t FROM tasks WHERE fu_tecnico_matricula_id='00000000-0000-0000-0000-000000000024' AND fu_tecnico_etapa='M+21';
 IF (fu_tecnico_confirmar_envio(t,123456,-123456,100)->>'ok')::boolean THEN RAISE EXCEPTION 'Canceled confirmed'; END IF;
END $$;
SELECT 'Confirmation and accompaniment independence assertions passed' AS result;