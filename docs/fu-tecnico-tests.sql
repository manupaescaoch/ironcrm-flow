-- Run only against the disposable bootstrap fixture, never production.
DO $$ BEGIN
 IF (SELECT count(*) FROM tasks)<>0 THEN RAISE EXCEPTION 'Old enrollment generated tasks'; END IF;
END $$;
INSERT INTO user_roles VALUES('00000000-0000-0000-0000-000000000030','coordenador');
INSERT INTO test_units VALUES('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000010');
SET test.uid='00000000-0000-0000-0000-000000000030';
INSERT INTO interacoes VALUES('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001',true,'2026-11-02',false);
UPDATE interacoes SET fechou_matricula=true WHERE id='00000000-0000-0000-0000-000000000021';
DO $$ BEGIN
 IF (SELECT count(*) FROM tasks)<>2 THEN RAISE EXCEPTION 'Missing stages or duplicated tasks'; END IF;
 IF (SELECT prazo FROM tasks WHERE fu_tecnico_etapa='M+7')<>'2026-11-09'::date THEN RAISE EXCEPTION 'Wrong M+7'; END IF;
 IF (SELECT prazo FROM tasks WHERE fu_tecnico_etapa='M+21')<>'2026-11-23'::date THEN RAISE EXCEPTION 'Wrong M+21'; END IF;
 BEGIN UPDATE tasks SET status='concluida' WHERE fu_tecnico_etapa='M+7'; RAISE EXCEPTION 'Completion without record accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Completion without record accepted' THEN RAISE; END IF; END;
END $$;
UPDATE tasks SET fu_tecnico_status='concluido',fu_tecnico_registro='{"data":"2026-11-02","coordenador":"COORDENADOR FICTÍCIO","canal":"presencial","observacoes":"ORIENTAÇÃO","dificuldades":"AGACHAMENTO","ajustes":"REVISAR EXECUÇÃO","encaminhamentos":"TREINADOR"}' WHERE fu_tecnico_etapa='M+7';
DO $$ BEGIN
 IF (SELECT status FROM tasks WHERE fu_tecnico_etapa='M+7')<>'concluida' THEN RAISE EXCEPTION 'Presencial not completed'; END IF;
 BEGIN DELETE FROM tasks WHERE fu_tecnico_etapa='M+7'; RAISE EXCEPTION 'History deleted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='History deleted' THEN RAISE; END IF; END;
END $$;
SET test.uid='';
DO $$ DECLARE t uuid; BEGIN
 SELECT id INTO t FROM tasks WHERE fu_tecnico_etapa='M+21';
 IF NOT fu_tecnico_claim(t,'2026-11-23') THEN RAISE EXCEPTION 'Eligible claim rejected'; END IF;
 IF fu_tecnico_claim(t,'2026-11-23') THEN RAISE EXCEPTION 'Same-day duplicate accepted'; END IF;
 IF NOT fu_tecnico_claim(t,'2026-11-24') THEN RAISE EXCEPTION 'Next-day reminder rejected'; END IF;
END $$;
SET test.uid='00000000-0000-0000-0000-000000000031';
INSERT INTO user_roles VALUES('00000000-0000-0000-0000-000000000031','coordenador');
DO $$ BEGIN
 BEGIN UPDATE tasks SET fu_tecnico_status='em_andamento' WHERE fu_tecnico_etapa='M+21'; RAISE EXCEPTION 'Other unit accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Other unit accepted' THEN RAISE; END IF; END;
END $$;
SET test.uid='00000000-0000-0000-0000-000000000030';
UPDATE leads SET unidade_id='00000000-0000-0000-0000-000000000011' WHERE id='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF (SELECT unidade_id FROM tasks WHERE fu_tecnico_etapa='M+21')<>'00000000-0000-0000-0000-000000000011'::uuid THEN RAISE EXCEPTION 'Transfer not synchronized'; END IF;
 IF (SELECT unidade_id FROM tasks WHERE fu_tecnico_etapa='M+7')<>'00000000-0000-0000-0000-000000000010'::uuid THEN RAISE EXCEPTION 'Completed history changed'; END IF;
END $$;
UPDATE leads SET ativo=false WHERE id='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF (SELECT fu_tecnico_status FROM tasks WHERE fu_tecnico_etapa='M+21')<>'cancelado' THEN RAISE EXCEPTION 'Inactive not canceled'; END IF;
END $$;
INSERT INTO interacoes VALUES('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001',true,'2026-11-03',false);
DO $$ BEGIN IF (SELECT count(*) FROM tasks)<>2 THEN RAISE EXCEPTION 'Inactive generated tasks'; END IF; END $$;
SET test.uid='';
UPDATE leads SET ativo=true WHERE id='00000000-0000-0000-0000-000000000001';
INSERT INTO interacoes VALUES('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000001',true,'2026-11-04',false);
DO $$ BEGIN IF (SELECT count(*) FROM tasks)<>4 THEN RAISE EXCEPTION 'New cycle not created'; END IF; END $$;
UPDATE interacoes SET cancelado=true WHERE id='00000000-0000-0000-0000-000000000023';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM tasks WHERE fu_tecnico_matricula_id='00000000-0000-0000-0000-000000000023' AND fu_tecnico_status<>'cancelado') THEN RAISE EXCEPTION 'Enrollment cancel ignored'; END IF; END $$;
SELECT 'All isolated technical FU assertions passed' AS result;