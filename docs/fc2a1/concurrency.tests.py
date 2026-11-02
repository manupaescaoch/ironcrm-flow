"""Run against an explicitly local Unix socket; synthetic test database only."""
import concurrent.futures, os, subprocess, sys
socket,port,user=sys.argv[1:4]
if not socket.startswith('/tmp/') or not os.path.exists(f'{socket}/.s.PGSQL.{port}'):
    raise SystemExit('Disposable local socket required')
base=['psql','-h',socket,'-p',port,'-U',user,'-d','fc2a1_test','-v','ON_ERROR_STOP=1','-At']
def query(sql):
    return subprocess.run(base+['-c',sql],text=True,capture_output=True)
setup=query("""select set_config('test.role','service_role',false);
with chosen as (select unidade_id from experimental_ciclos_config limit 1),
l as (insert into leads(unidade_id) select unidade_id from chosen returning id,unidade_id),
i as (insert into interacoes(lead_id,unidade_id,agendou_experimental,data_experimental,hora_experimental,compareceu) select id,unidade_id,true,current_date,'15:00',null from l returning id)
select experimental_novo_ciclo(id,current_date,'15:00',null,'integracao','concurrent-create') from i;
""")
if setup.returncode: raise SystemExit(setup.stderr)
cycle=setup.stdout.strip().splitlines()[-1]
def confirm(result):
    return query(f"select set_config('test.role','service_role',false);select experimental_confirmar('{cycle}','{result}',null,'integracao','race-{result}',0);")
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    answers=list(pool.map(confirm,['compareceu','nao_compareceu']))
assert sum(a.returncode==0 for a in answers)==1, 'Concurrent opposite results must commit exactly one answer'
state=query(f"select count(*) from experimental_ciclo_eventos where ciclo_id='{cycle}' and tipo='confirmado';select count(*) from experimental_ciclo_contexto;")
assert state.returncode==0 and state.stdout.strip().splitlines()==['1','0'], 'Exactly one event and clean transaction context'
print('PASS: competing opposite confirmations commit exactly one result')
print('PASS: transaction context cannot leak across backend sessions')