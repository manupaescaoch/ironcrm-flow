-- Homologação final GERÊNCIA M+15/M+30. Somente banco descartável; nunca produção.
-- Reusa o fixture de docs/fu-gerencial-tests.sql (unidade ...0010, grupo gerência -123, usuário 123=gerente).
CREATE FUNCTION public.test_assert(v boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF v IS DISTINCT FROM true THEN RAISE EXCEPTION '%',msg; END IF; END $$;

-- 1. Matrícula nova após o corte M+15 cria exatamente M+15 e M+30.
INSERT INTO leads VALUES ('00000000-0000-0000-0000-000000000101','ALUNA M15','00000000-0000-0000-0000-000000000010',true,true,'convertido','5581971110001');
INSERT INTO interacoes VALUES ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101',true,'2026-11-06',false,now());
SELECT test_assert((SELECT count(*)=1 FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000201' AND fu_gerencial_etapa='M+15'),'M+15 nao criado');
SELECT test_assert((SELECT count(*)=1 FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000201' AND fu_gerencial_etapa='M+30'),'M+30 nao criado');

-- 2. Vencimento em fim de semana vai para segunda-feira (06/11 sexta: +15=sab 21/11 -> seg 23/11; +30=dom 06/12 -> seg 07/12).
SELECT test_assert((SELECT prazo='2026-11-23'::date FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000201' AND fu_gerencial_etapa='M+15'),'M+15 sem transferencia para segunda');
SELECT test_assert((SELECT prazo='2026-12-07'::date FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000201' AND fu_gerencial_etapa='M+30'),'M+30 sem transferencia para segunda');

-- 3. Atualização repetida da mesma matrícula não duplica tarefas.
UPDATE interacoes SET fechou_matricula=true WHERE id='00000000-0000-0000-0000-000000000201';
SELECT test_assert((SELECT count(*)=2 FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000201'),'Matricula repetida duplicou tarefas');

-- 4. Matrícula entre o corte M+30 e o corte M+15 gera somente M+30 (sem retroativo M+15).
INSERT INTO leads VALUES ('00000000-0000-0000-0000-000000000102','ALUNO ANTES M15','00000000-0000-0000-0000-000000000010',true,true,'convertido','5581971110002');
INSERT INTO interacoes VALUES ('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000102',true,'2026-11-02',false,'2026-11-02T18:30:00Z');
SELECT test_assert((SELECT count(*)=0 FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000202' AND fu_gerencial_etapa='M+15'),'M+15 retroativo criado');
SELECT test_assert((SELECT count(*)=1 FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000202' AND fu_gerencial_etapa='M+30'),'M+30 ausente para matricula anterior ao corte M+15');

-- 5. Matrícula anterior à ativação não gera nenhuma tarefa.
INSERT INTO leads VALUES ('00000000-0000-0000-0000-000000000103','ALUNO LEGADO','00000000-0000-0000-0000-000000000010',true,true,'convertido','5581971110003');
INSERT INTO interacoes VALUES ('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000103',true,'2026-10-15',false,'2026-10-15T12:00:00Z');
SELECT test_assert((SELECT count(*)=0 FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000203'),'Tarefa retroativa criada');

-- 6. Claim M+15: antes do prazo recusa, sábado recusa, no prazo aceita, repetido no dia recusa.
DO $$ DECLARE t uuid; BEGIN
 SELECT id INTO t FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000201' AND fu_gerencial_etapa='M+15';
 IF fu_gerencial_claim(t,'2026-11-20') THEN RAISE EXCEPTION 'Claim M+15 antes do prazo aceito'; END IF;
 IF fu_gerencial_claim(t,'2026-11-21') THEN RAISE EXCEPTION 'Claim M+15 em sabado aceito'; END IF;
 IF NOT fu_gerencial_claim(t,'2026-11-23') THEN RAISE EXCEPTION 'Claim M+15 no prazo recusado'; END IF;
 IF fu_gerencial_claim(t,'2026-11-23') THEN RAISE EXCEPTION 'Claim M+15 duplicado no dia'; END IF;
END $$;

-- 7. Confirmação M+15: usuário não vinculado, grupo errado e mensagem errada recusados; correto aceita; duplicado idempotente; conclusão separada.
DO $$ DECLARE t uuid; r jsonb; BEGIN
 SELECT id INTO t FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000201' AND fu_gerencial_etapa='M+15';
 UPDATE tasks SET fu_gerencial_telegram_chat_id=-123,fu_gerencial_telegram_message_id=200 WHERE id=t;
 IF (fu_gerencial_confirmar_envio(t,999,-123,200)->>'ok')::boolean THEN RAISE EXCEPTION 'Usuario nao vinculado confirmou M+15'; END IF;
 IF (fu_gerencial_confirmar_envio(t,123,-456,200)->>'ok')::boolean THEN RAISE EXCEPTION 'Grupo errado confirmou M+15'; END IF;
 IF (fu_gerencial_confirmar_envio(t,123,-123,99)->>'ok')::boolean THEN RAISE EXCEPTION 'Mensagem errada confirmou M+15'; END IF;
 r:=fu_gerencial_confirmar_envio(t,123,-123,200);
 IF r->>'ok'<>'true' OR r->>'duplicado'<>'false' OR r->>'etapa'<>'M+15' THEN RAISE EXCEPTION 'Confirmacao M+15 falhou %',r; END IF;
 IF (SELECT fu_gerencial_status FROM tasks WHERE id=t)<>'pendente' THEN RAISE EXCEPTION 'Confirmacao concluiu o acompanhamento M+15'; END IF;
 IF fu_gerencial_confirmar_envio(t,123,-123,200)->>'duplicado'<>'true' THEN RAISE EXCEPTION 'Confirmacao M+15 nao idempotente'; END IF;
 IF (SELECT count(*) FROM task_history WHERE task_id=t AND campo='fu_gerencial_envio_aluno')<>1 THEN RAISE EXCEPTION 'Historico M+15 duplicado'; END IF;
 IF fu_gerencial_claim(t,'2026-11-24') THEN RAISE EXCEPTION 'M+15 confirmado voltou a ser lembrado'; END IF;
END $$;

-- 8. Cancelamento da matrícula cancela as tarefas pendentes do ciclo.
INSERT INTO leads VALUES ('00000000-0000-0000-0000-000000000104','ALUNA CANCELA','00000000-0000-0000-0000-000000000010',true,true,'convertido','5581971110004');
INSERT INTO interacoes VALUES ('00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000104',true,'2026-11-02',false,now());
UPDATE interacoes SET cancelado=true WHERE id='00000000-0000-0000-0000-000000000204';
SELECT test_assert((SELECT count(*)=2 FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000204' AND fu_gerencial_status='cancelado'),'Cancelamento nao cancelou M+15/M+30');

-- 9. Confirmação recusada após cancelamento.
DO $$ DECLARE t uuid; BEGIN
 SELECT id INTO t FROM tasks WHERE fu_gerencial_matricula_id='00000000-0000-0000-0000-000000000204' AND fu_gerencial_etapa='M+15';
 UPDATE tasks SET fu_gerencial_telegram_chat_id=-123,fu_gerencial_telegram_message_id=201 WHERE id=t;
 IF (fu_gerencial_confirmar_envio(t,123,-123,201)->>'ok')::boolean THEN RAISE EXCEPTION 'Cancelado confirmado'; END IF;
END $$;

SELECT 'Homologacao GERENCIA M+15/M+30: todas as assercoes passaram' AS result;
