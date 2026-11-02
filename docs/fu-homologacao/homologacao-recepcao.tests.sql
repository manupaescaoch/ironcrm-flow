-- Homologação final RECEPÇÃO M+3/M+32 e D+30 desativado. Somente banco descartável; nunca produção.
-- Reusa o fixture de docs/fu-matriculados-tests.sql (unidade ...0010, grupo comercial -111, usuário 111).
-- test_assert já existe (criado por fu-matriculados-tests.sql).

-- 1. Matrícula nova após o corte da Recepção cria BV + M+3 + M+32.
INSERT INTO leads(id,nome,unidade_id,ativo,is_matriculado,status_funil,telefone) VALUES('00000000-0000-0000-0000-000000000201','ALUNA RECEPCAO','00000000-0000-0000-0000-000000000010',true,true,'matriculado','81997111001');
INSERT INTO interacoes(id,lead_id,unidade_id,tipo,fechou_matricula,data_fechamento,created_at) VALUES('00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000010','Presencial',true,'2026-11-05',now());
SELECT test_assert((SELECT count(*)=3 FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000301'),'Matricula nova nao criou BV+M+3+M+32');
SELECT test_assert((SELECT count(*)=1 FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000301' AND fu_matriculados_etapa='BV'),'BV ausente');
SELECT test_assert((SELECT count(*)=1 FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000301' AND fu_matriculados_etapa='M+3'),'M+3 ausente');
SELECT test_assert((SELECT count(*)=1 FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000301' AND fu_matriculados_etapa='M+32'),'M+32 ausente');

-- 2. Vencimento em fim de semana vai para segunda (05/11 quinta: +3=dom 08/11 -> seg 09/11; +32=seg 07/12 sem deslocamento).
SELECT test_assert((SELECT prazo='2026-11-09'::date FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000301' AND fu_matriculados_etapa='M+3'),'M+3 sem transferencia para segunda');
SELECT test_assert((SELECT prazo='2026-12-07'::date FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000301' AND fu_matriculados_etapa='M+32'),'M+32 com prazo errado');

-- 3. Atualização repetida não duplica; segunda matrícula ativa (renovação) não gera novas tarefas.
UPDATE interacoes SET fechou_matricula=true WHERE id='00000000-0000-0000-0000-000000000301';
SELECT test_assert((SELECT count(*)=3 FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000301'),'Repeticao duplicou tarefas da Recepcao');
INSERT INTO interacoes(id,lead_id,unidade_id,tipo,fechou_matricula,data_fechamento,created_at) VALUES('00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000010','Presencial',true,'2026-11-05',now());
SELECT test_assert((SELECT count(*)=0 FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000302'),'Renovacao gerou tarefas');

-- 4. Matrícula entre o corte de Boas-vindas e o corte da Recepção gera somente BV (sem M+3/M+32 retroativos).
INSERT INTO leads(id,nome,unidade_id,ativo,is_matriculado,status_funil,telefone) VALUES('00000000-0000-0000-0000-000000000202','ALUNO ANTES RECEPCAO','00000000-0000-0000-0000-000000000010',true,true,'matriculado','81997111002');
INSERT INTO interacoes(id,lead_id,unidade_id,tipo,fechou_matricula,data_fechamento,created_at) VALUES('00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000010','Presencial',true,'2026-11-02','2026-11-02T12:00:00Z');
SELECT test_assert((SELECT count(*)=1 FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000303' AND fu_matriculados_etapa='BV'),'BV ausente para matricula anterior ao corte da Recepcao');
SELECT test_assert((SELECT count(*)=0 FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000303' AND fu_matriculados_etapa<>'BV'),'M+3/M+32 retroativo criado');

-- 5. Matrícula anterior à ativação não gera nenhuma tarefa.
INSERT INTO leads(id,nome,unidade_id,ativo,is_matriculado,status_funil,telefone) VALUES('00000000-0000-0000-0000-000000000203','ALUNO LEGADO REC','00000000-0000-0000-0000-000000000010',true,true,'matriculado','81997111003');
INSERT INTO interacoes(id,lead_id,unidade_id,tipo,fechou_matricula,data_fechamento,created_at) VALUES('00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000010','Presencial',true,'2026-10-15','2026-10-15T12:00:00Z');
SELECT test_assert((SELECT count(*)=0 FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000304'),'Tarefa retroativa da Recepcao criada');

-- 6. Claim: M+3 antes do prazo recusa; BV no prazo aceita uma única vez no dia.
DO $$ DECLARE t_bv uuid; t_m3 uuid; BEGIN
 SELECT id INTO t_bv FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000301' AND fu_matriculados_etapa='BV';
 SELECT id INTO t_m3 FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000301' AND fu_matriculados_etapa='M+3';
 IF fu_matriculados_claim(t_m3,(now() AT TIME ZONE 'America/Recife')::date) THEN RAISE EXCEPTION 'Claim M+3 antes do prazo aceito'; END IF;
 IF NOT fu_matriculados_claim(t_bv,(now() AT TIME ZONE 'America/Recife')::date) THEN RAISE EXCEPTION 'Claim BV no prazo recusado'; END IF;
 IF fu_matriculados_claim(t_bv,(now() AT TIME ZONE 'America/Recife')::date) THEN RAISE EXCEPTION 'Claim BV duplicado no dia'; END IF;
END $$;

-- 7. Confirmação M+3: usuário não vinculado, chat errado e mensagem errada recusados; correto aceita; duplicado idempotente; não marca boas-vindas; conclusão separada.
DO $$ DECLARE t uuid; r jsonb; BEGIN
 SELECT id INTO t FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000301' AND fu_matriculados_etapa='M+3';
 UPDATE tasks SET fu_matriculados_chat_id=-111,fu_matriculados_message_id=300 WHERE id=t;
 IF (fu_matriculados_confirmar_envio(t,999,-111,300)->>'ok')::boolean THEN RAISE EXCEPTION 'Usuario nao vinculado confirmou M+3'; END IF;
 IF (fu_matriculados_confirmar_envio(t,111,-222,300)->>'ok')::boolean THEN RAISE EXCEPTION 'Chat errado confirmou M+3'; END IF;
 IF (fu_matriculados_confirmar_envio(t,111,-111,99)->>'ok')::boolean THEN RAISE EXCEPTION 'Mensagem errada confirmou M+3'; END IF;
 r:=fu_matriculados_confirmar_envio(t,111,-111,300);
 IF r->>'ok'<>'true' OR r->>'duplicado'<>'false' OR r->>'etapa'<>'M+3' THEN RAISE EXCEPTION 'Confirmacao M+3 falhou %',r; END IF;
 IF (SELECT status FROM tasks WHERE id=t)<>'a_fazer' THEN RAISE EXCEPTION 'Confirmacao M+3 concluiu o acompanhamento'; END IF;
 IF (SELECT boas_vindas_enviada_em FROM interacoes WHERE id='00000000-0000-0000-0000-000000000301') IS NOT NULL THEN RAISE EXCEPTION 'M+3 marcou boas-vindas'; END IF;
 IF fu_matriculados_confirmar_envio(t,111,-111,300)->>'duplicado'<>'true' THEN RAISE EXCEPTION 'Confirmacao M+3 nao idempotente'; END IF;
 IF (SELECT count(*) FROM task_history WHERE task_id=t AND campo='fu_recepcao_envio_aluno')<>1 THEN RAISE EXCEPTION 'Historico M+3 duplicado'; END IF;
END $$;

-- 8. Cancelamento da matrícula encerra as etapas não confirmadas.
INSERT INTO leads(id,nome,unidade_id,ativo,is_matriculado,status_funil,telefone) VALUES('00000000-0000-0000-0000-000000000204','ALUNA CANCELA REC','00000000-0000-0000-0000-000000000010',true,true,'matriculado','81997111004');
INSERT INTO interacoes(id,lead_id,unidade_id,tipo,fechou_matricula,data_fechamento,created_at) VALUES('00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000010','Presencial',true,'2026-11-02',now());
UPDATE interacoes SET cancelado=true WHERE id='00000000-0000-0000-0000-000000000305';
SELECT test_assert((SELECT count(*)=3 FROM tasks WHERE fu_matriculados_matricula_id='00000000-0000-0000-0000-000000000305' AND status='concluida'),'Cancelamento nao encerrou BV/M+3/M+32');

-- 9. D+30 automático desativado: insert é bloqueado; D+1 permanece permitido.
INSERT INTO follow_ups(lead_id,unidade_id,tipo,data_referencia,data_prevista) VALUES('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000010','D+30',now(),now());
SELECT test_assert((SELECT count(*)=0 FROM follow_ups WHERE tipo='D+30'),'D+30 automatico criado');
INSERT INTO follow_ups(lead_id,unidade_id,tipo,data_referencia,data_prevista) VALUES('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000010','D+1',now(),now());
SELECT test_assert((SELECT count(*)=1 FROM follow_ups WHERE tipo='D+1'),'D+1 bloqueado indevidamente');

SELECT 'Homologacao RECEPCAO M+3/M+32 e D+30: todas as assercoes passaram' AS result;
