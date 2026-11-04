import subprocess,json,concurrent.futures
# Fixture prerequisite: existing definitions/tables from Fase 1C, fresh disposable local database.
B=['psql','-h','/tmp/fu-phase1c/socket','-p','55439','-U','lovable','-d','postgres','-X','-v','ON_ERROR_STOP=1','-At']
def q(s,ok=True):
 r=subprocess.run(B+['-c',s],capture_output=True,text=True)
 if ok and r.returncode:raise RuntimeError(r.stderr)
 if not ok and not r.returncode:raise AssertionError('expected deny')
 return r.stdout.strip()
q("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;ALTER TABLE tasks ADD COLUMN arquivada boolean DEFAULT false;CREATE TABLE follow_ups(id uuid PRIMARY KEY,lead_id uuid,unidade_id uuid,tipo text,status text,concluido_em timestamptz,concluido_por text);ALTER TABLE interacoes ADD COLUMN tipo text;ALTER TABLE interacoes ADD COLUMN descricao text;ALTER TABLE interacoes ADD COLUMN data_interacao timestamptz;ALTER TABLE interacoes ADD COLUMN atendido_por text;ALTER TABLE interacoes ADD COLUMN created_by uuid;")
q(open('/dev-server/docs/fu-phase1d/confirmations.candidate.sql').read())
def u(i):return f'00000000-0000-4000-8000-{i:012d}'
unit=u(1);lead=u(2);en=u(3);checks=0
for n,(f,stages) in enumerate([('tecnico',['M+7','M+21']),('gerencial',['M+15','M+30']),('matriculados',['BV','M+3','M+32'])],1):
 p='fu_'+f;actor=u(100+n);tg=100+n;chat=-1000-n
 for k,stage in enumerate(stages):
  task=u(500+n*10+k); c1='chat_id' if f=='matriculados' else 'telegram_chat_id';c2='message_id' if f=='matriculados' else 'telegram_message_id'
  q(f"INSERT INTO tasks(id,unidade_id,status,{p}_lead_id,{p}_matricula_id,{p}_etapa,{p}_status,{p}_{c1},{p}_{c2}) VALUES('{task}','{unit}','a_fazer','{lead}','{en}','{stage}','pendente',{chat},1);")
  sql=f"SELECT fu_crm_confirmar_envio('{task}','{actor}','{lead}','{en}','{unit}','{stage}');"
  tele=f"SELECT {p}_confirmar_envio('{task}',{tg},{chat},1);"
  with concurrent.futures.ThreadPoolExecutor(2) as ex:r=list(ex.map(lambda s:json.loads(q(s)),[sql,tele]))
  assert all(x['ok'] for x in r) and sorted(x['duplicado'] for x in r)==[False,True];checks+=1
  assert q(f"SELECT count(*) FROM task_history WHERE task_id='{task}';")=='1';checks+=1
  assert q(f"SELECT status FROM tasks WHERE id='{task}';")=='a_fazer';checks+=1
  assert json.loads(q(sql))['duplicado'];checks+=1
  q(sql.replace(actor,u(201) if n!=1 else u(203)),False);checks+=1
  q(sql.replace(unit,u(999)),False);checks+=1
  q(sql.replace(lead,u(999)),False);checks+=1
  q('SET ROLE authenticated;'+sql,False);checks+=1
  print('PASS CRM x Telegram',stage)
# moderator denied Reception despite UI role
q(f"INSERT INTO user_roles VALUES('{u(900)}','moderator');INSERT INTO test_units VALUES('{u(900)}','{unit}');")
q(f"SELECT fu_crm_confirmar_envio('{u(532)}','{u(900)}','{lead}','{en}','{unit}','M+32');",False);checks+=1
# new commercial transaction race
fu=u(1000);actor=u(103)
q(f"INSERT INTO follow_ups VALUES('{fu}','{lead}','{unit}','D+1','pendente',NULL,NULL);")
cs=f"SELECT fu_comercial_confirmar_transacional('{fu}','{actor}','{lead}','{unit}','D+1');"
with concurrent.futures.ThreadPoolExecutor(2) as ex:r=list(ex.map(lambda _:json.loads(q(cs)),range(2)))
assert sorted(x['alreadyConfirmed'] for x in r)==[False,True];checks+=1
assert all(x['historyPending']==False for x in r);checks+=1
hist=[x.get('historyId') for x in r if x.get('historyId')][0]
assert q(f"SELECT count(*) FROM interacoes WHERE id='{hist}';")=='1';checks+=1
# SQL id must equal JS historical identity
at=q(f"SELECT to_char(concluido_em AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') FROM follow_ups WHERE id='{fu}';")
import hashlib
bs=bytearray(hashlib.sha256(f'fu-confirmation:{fu}:{at}'.encode()).digest()[:16]);bs[6]=(bs[6]&15)|80;bs[8]=(bs[8]&63)|128
import uuid
assert str(uuid.UUID(bytes=bytes(bs)))==hist;checks+=1
# existing missing history is reported, never recreated
q(f"DELETE FROM interacoes WHERE id='{hist}';")
assert json.loads(q(cs))['historyPending'];checks+=1
assert q(f"SELECT count(*) FROM interacoes WHERE id='{hist}';")=='0';checks+=1
# failure history rolls back transaction
fu2=u(1001);q(f"INSERT INTO follow_ups VALUES('{fu2}','{lead}','{unit}','D+7','pendente',NULL,NULL);ALTER TABLE interacoes ADD CONSTRAINT synthetic_history_failure CHECK(tipo IS DISTINCT FROM 'Follow Up') NOT VALID;")
q(cs.replace(fu,fu2).replace('D+1','D+7'),False)
assert q(f"SELECT status FROM follow_ups WHERE id='{fu2}';")=='pendente';checks+=1
q('ALTER TABLE interacoes DROP CONSTRAINT synthetic_history_failure;')
print(checks,'SQL checks passed including 7 stages CRM x Telegram and commercial atomic rollback')
