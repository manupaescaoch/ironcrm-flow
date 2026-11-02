-- Disposable fixture only; never production. Bootstrap in /tmp with fake users and students.
INSERT INTO unidades VALUES ('00000000-0000-0000-0000-000000000010','UNIDADE TESTE');
INSERT INTO leads VALUES ('00000000-0000-0000-0000-000000000001','ALUNO FICTÍCIO','00000000-0000-0000-0000-000000000010',true,true,'convertido','5581999990000');
INSERT INTO user_roles VALUES('00000000-0000-0000-0000-000000000030','gerente'),('00000000-0000-0000-0000-000000000031','coordenador');
INSERT INTO test_units VALUES('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000010'),('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000010');
INSERT INTO telegram_users VALUES('00000000-0000-0000-0000-000000000030',123,'conectado','GERENTE','TESTE'),('00000000-0000-0000-0000-000000000031',124,'conectado','COORD','TESTE');
INSERT INTO telegram_groups VALUES('00000000-0000-0000-0000-000000000010','gerencia','conectado',-123);
INSERT INTO interacoes VALUES('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001',true,'2026-10-01',false,'2026-10-01');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM tasks WHERE fu_gerencial_etapa IS NOT NULL) THEN RAISE EXCEPTION 'Retroactive manager tasks'; END IF; END $$;
INSERT INTO interacoes VALUES('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001',true,'2026-11-02',false,now());
UPDATE interacoes SET fechou_matricula=true WHERE id='00000000-0000-0000-0000-000000000021';
DO $$ DECLARE t uuid; r jsonb; BEGIN
 IF (SELECT count(*) FROM tasks WHERE fu_gerencial_etapa='M+30')<>1 THEN RAISE EXCEPTION 'Duplicated manager task'; END IF;
 IF (SELECT prazo FROM tasks WHERE fu_gerencial_etapa='M+30')<>'2026-12-02'::date THEN RAISE EXCEPTION 'M+30 wrong deadline'; END IF;
 IF (SELECT count(*) FROM tasks WHERE fu_tecnico_matricula_id='00000000-0000-0000-0000-000000000021')<>2 THEN RAISE EXCEPTION 'Technical stages modified'; END IF;
 SELECT id INTO t FROM tasks WHERE fu_gerencial_etapa='M+30';
 IF fu_gerencial_claim(t,'2026-12-01') THEN RAISE EXCEPTION 'Early claim accepted'; END IF;
 IF NOT fu_gerencial_claim(t,'2026-12-02') THEN RAISE EXCEPTION 'Due claim rejected'; END IF;
 IF fu_gerencial_claim(t,'2026-12-02') THEN RAISE EXCEPTION 'Daily duplicate'; END IF;
 IF fu_gerencial_claim(t,'2026-12-05') THEN RAISE EXCEPTION 'Saturday sent'; END IF;
 UPDATE tasks SET fu_gerencial_telegram_chat_id=-123,fu_gerencial_telegram_message_id=100 WHERE id=t;
 IF (fu_gerencial_confirmar_envio(t,999,-123,100)->>'ok')::boolean THEN RAISE EXCEPTION 'Unlinked user'; END IF;
 IF (fu_gerencial_confirmar_envio(t,124,-123,100)->>'ok')::boolean THEN RAISE EXCEPTION 'Coordinator confirmed manager FU'; END IF;
 IF (fu_gerencial_confirmar_envio(t,123,-456,100)->>'ok')::boolean THEN RAISE EXCEPTION 'Wrong group'; END IF;
 IF (fu_gerencial_confirmar_envio(t,123,-123,99)->>'ok')::boolean THEN RAISE EXCEPTION 'Wrong message'; END IF;
 r:=fu_gerencial_confirmar_envio(t,123,-123,100);
 IF r->>'ok'<>'true' OR r->>'duplicado'<>'false' THEN RAISE EXCEPTION 'Confirmation failed %',r; END IF;
 IF (SELECT fu_gerencial_status FROM tasks WHERE id=t)<>'pendente' THEN RAISE EXCEPTION 'Confirmation completed followup'; END IF;
 IF (SELECT fu_gerencial_confirmado_por FROM tasks WHERE id=t)<>'00000000-0000-0000-0000-000000000030'::uuid OR (SELECT fu_gerencial_confirmado_em FROM tasks WHERE id=t) IS NULL THEN RAISE EXCEPTION 'Missing author/time'; END IF;
 IF fu_gerencial_confirmar_envio(t,123,-123,100)->>'duplicado'<>'true' THEN RAISE EXCEPTION 'Not idempotent'; END IF;
 IF (SELECT count(*) FROM task_history WHERE task_id=t AND campo='fu_gerencial_envio_aluno')<>1 THEN RAISE EXCEPTION 'Duplicate history'; END IF;
 IF fu_gerencial_claim(t,'2026-12-03') THEN RAISE EXCEPTION 'Confirmed FU reminded'; END IF;
END $$;
SET test.uid='00000000-0000-0000-0000-000000000031';
DO $$ BEGIN
 BEGIN UPDATE tasks SET fu_gerencial_status='em_andamento' WHERE fu_gerencial_etapa='M+30'; RAISE EXCEPTION 'Coordinator edited manager FU'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Coordinator edited manager FU' THEN RAISE; END IF; END;
END $$;
SET test.uid='00000000-0000-0000-0000-000000000030';
DO $$ BEGIN
 BEGIN UPDATE tasks SET fu_gerencial_confirmado_nome='FORGED' WHERE fu_gerencial_etapa='M+30'; RAISE EXCEPTION 'Client forged confirmation'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Client forged confirmation' THEN RAISE; END IF; END;
 BEGIN UPDATE tasks SET status='concluida' WHERE fu_gerencial_etapa='M+30'; RAISE EXCEPTION 'Completed without record'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Completed without record' THEN RAISE; END IF; END;
END $$;
UPDATE tasks SET fu_gerencial_status='concluido',fu_gerencial_registro='{"data":"2026-11-02","gerente":"GERENTE TESTE","canal":"presencial","percepcao":"SATISFEITO","reclamacoes":"","melhorias":"HORÁRIOS","providencias":"REVISAR"}' WHERE fu_gerencial_etapa='M+30';
DO $$ BEGIN IF (SELECT status FROM tasks WHERE fu_gerencial_etapa='M+30')<>'concluida' OR (SELECT fu_gerencial_concluido_em FROM tasks WHERE fu_gerencial_etapa='M+30') IS NULL THEN RAISE EXCEPTION 'Presential completion failed'; END IF; END $$;
SET test.uid='';
INSERT INTO interacoes VALUES('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001',true,'2026-11-02',false,now());
INSERT INTO whatsapp_envios_log VALUES('00000000-0000-0000-0000-000000000010','lead',true,'5581999990000','2026-12-02T12:00:00Z');
DO $$ DECLARE t uuid; r jsonb; BEGIN
 SELECT id INTO t FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000022';
 r:=fu_gerencial_contexto(t,'2026-12-03T11:00:00Z');
 IF r->>'adiar_ate' IS NULL OR (r->>'adiar_ate')::date < '2026-12-05' THEN RAISE EXCEPTION '72h cooldown ignored %',r; END IF;
END $$;
INSERT INTO nps_respostas VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','2026-11-02',3,'novo');
DO $$ DECLARE r jsonb; BEGIN
 SELECT fu_gerencial_contexto(id,'2026-12-03T11:00:00Z') INTO r FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000022';
 IF r->>'avisos' NOT LIKE '%PRIORIDADE%' THEN RAISE EXCEPTION 'Open complaint missing'; END IF;
END $$;
UPDATE leads SET ativo=false WHERE id='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM tasks WHERE fu_gerencial_status IN ('pendente','em_andamento')) THEN RAISE EXCEPTION 'Inactive still pending'; END IF; END $$;
INSERT INTO interacoes VALUES('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000001',true,'2026-11-02',false,now());
DO $$ BEGIN IF (SELECT count(*) FROM tasks WHERE fu_gerencial_etapa='M+30')<>2 THEN RAISE EXCEPTION 'Inactive generated task'; END IF; END $$;
SELECT 'Manager FU isolated assertions passed' AS result;