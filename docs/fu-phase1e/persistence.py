"""Failures and unchanged metrics on real public schema, local only."""
import json
from structural import task, crm, uid, ACTORS, UNIT, LEAD, denied
from prepare import sql

checks = 0
# Failure in history must roll back task and central evidence in one SQL transaction.
t, prefix, _ = task(500, 'matriculados', 'M+32')
sql("CREATE FUNCTION synthetic_history_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.task_id='00000000-0000-4000-8000-000000000500' THEN RAISE EXCEPTION 'synthetic history failure'; END IF; RETURN NEW; END$$; CREATE TRIGGER synthetic_history_failure BEFORE INSERT ON task_history FOR EACH ROW EXECUTE FUNCTION synthetic_history_failure();")
denied(crm(t, ACTORS['moderator'], 'M+32'))
assert sql(f"SELECT fu_matriculados_confirmado_em IS NULL FROM tasks WHERE id='{t}'") == 't'
assert sql(f"SELECT count(*) FROM contato_execucoes WHERE chave='manual:{prefix}:{t}'") == '0'
checks += 2
sql('DROP TRIGGER synthetic_history_failure ON task_history; DROP FUNCTION synthetic_history_failure();')
# Confirm author, timestamp and stage classification using the real evidence table.
for i, stage in enumerate(['BV', 'M+3', 'M+32'], 501):
    t, prefix, _ = task(i, 'matriculados', stage)
    r = json.loads(sql(crm(t, ACTORS['moderator'], stage)))
    assert sql(f"SELECT fu_matriculados_confirmado_por='{ACTORS['moderator']}' AND fu_matriculados_confirmado_em<=now() FROM tasks WHERE id='{t}'") == 't'
    assert sql(f"SELECT objetivo FROM contato_execucoes WHERE chave='manual:{prefix}:{t}'") == ('boas_vindas' if stage == 'BV' else 'experiencia')
    assert sql(f"SELECT tipo_fu FROM contato_execucoes WHERE chave='manual:{prefix}:{t}'") == stage
    assert sql(f"SELECT campo FROM task_history WHERE task_id='{t}'") == ('fu_matriculados_envio_aluno' if stage == 'BV' else 'fu_recepcao_envio_aluno')
    before = sql(f"SELECT count(*) FROM task_history WHERE task_id='{t}'")
    assert json.loads(sql(crm(t, ACTORS['moderator'], stage)))['confirmado_em'] == r['confirmado_em']
    assert sql(f"SELECT count(*) FROM task_history WHERE task_id='{t}'") == before
    checks += 6
# Lead enrollment/attendance aggregate flags must not change on confirmation.
t, _, _ = task(504, 'tecnico', 'M+7')
metric = "SELECT json_build_object('enrolled',(SELECT count(*) FROM leads WHERE is_matriculado),'closings',(SELECT count(*) FROM interacoes WHERE fechou_matricula),'attended',(SELECT count(*) FROM interacoes WHERE compareceu),'scheduled',(SELECT count(*) FROM interacoes WHERE agendou_experimental));"
before = sql(metric)
sql(crm(t, ACTORS['coordenador'], 'M+7'))
assert sql(metric) == before
checks += 1
# Disabled D+30 remains enforced by its original BEFORE INSERT trigger.
denied(f"INSERT INTO follow_ups(lead_id,unidade_id,tipo,data_referencia,data_prevista) VALUES('{LEAD}','{UNIT}','D+30',now(),now());")
checks += 1
# Commercial transaction history failure must also roll back status and evidence.
f = uid(850)
sql(f"INSERT INTO follow_ups(id,lead_id,unidade_id,tipo,data_referencia,data_prevista) VALUES('{f}','{LEAD}','{UNIT}','D+7',now(),now()); CREATE FUNCTION synthetic_commercial_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.tipo='Follow Up' THEN RAISE EXCEPTION 'synthetic history failure'; END IF; RETURN NEW; END$$; CREATE TRIGGER synthetic_commercial_failure BEFORE INSERT ON interacoes FOR EACH ROW EXECUTE FUNCTION synthetic_commercial_failure();")
c = f"SELECT fu_comercial_confirmar_transacional('{f}','{ACTORS['user']}','{LEAD}','{UNIT}','D+7');"
denied(c)
assert sql(f"SELECT status FROM follow_ups WHERE id='{f}'") == 'pendente'
checks += 1
sql('DROP TRIGGER synthetic_commercial_failure ON interacoes; DROP FUNCTION synthetic_commercial_failure();')
r = json.loads(sql(c))
assert sql(f"SELECT created_by='{ACTORS['user']}' AND tipo='Follow Up' AND descricao='Follow-up D+7 realizado via WhatsApp' FROM interacoes WHERE id='{r['historyId']}'") == 't'
checks += 1
# Legacy missing history is reported, not silently repaired or recreated.
sql(f"DELETE FROM interacoes WHERE id='{r['historyId']}';")
assert json.loads(sql(c))['historyPending']
assert sql(f"SELECT count(*) FROM interacoes WHERE id='{r['historyId']}'") == '0'
checks += 2
print(f'{checks} persistence/stage/author/metric/rollback/legacy assertions passed')