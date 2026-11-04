import concurrent.futures
import hashlib
import json
import uuid
from prepare import sql, BASE
import subprocess

def uid(i):
    return f'00000000-0000-4000-8000-{i:012d}'

def denied(query):
    result = subprocess.run(BASE + ['-c', query], capture_output=True, text=True)
    assert result.returncode != 0, 'Unauthorized operation unexpectedly succeeded'

UNIT, OTHER, LEAD, ENROLL = uid(1), uid(9), uid(2), uid(3)
ACTORS = {'admin': uid(101), 'gerente': uid(102), 'coordenador': uid(103), 'user': uid(104), 'moderator': uid(105), 'none': uid(106), 'other': uid(107)}

def seed():
    sql(f"INSERT INTO unidades(id,nome,slug) VALUES('{UNIT}','FICTICIA A','test-a'),('{OTHER}','FICTICIA B','test-b');")
    for role, actor in ACTORS.items():
        sql(f"INSERT INTO auth.users(id,email) VALUES('{actor}','{role}@example.invalid'); INSERT INTO user_unidades(user_id,unidade_id) VALUES('{actor}','{OTHER if role == 'other' else UNIT}'); INSERT INTO cronograma_funcionarios(user_id,unidade_id,nome) VALUES('{actor}','{OTHER if role == 'other' else UNIT}','TESTE {role.upper()}'); INSERT INTO telegram_users(user_id,telegram_user_id,status) VALUES('{actor}',{int(actor[-12:])},'conectado');")
        if role != 'none':
            sql(f"INSERT INTO user_roles(user_id,role) VALUES('{actor}','{'user' if role == 'other' else role}');")
    sql(f"INSERT INTO leads(id,nome,telefone,unidade_id,ativo,is_matriculado,status_funil) VALUES('{LEAD}','ALUNO FICTICIO','81900000000','{UNIT}',true,true,'convertido'); INSERT INTO interacoes(id,lead_id,unidade_id,tipo,fechou_matricula,data_fechamento) VALUES('{ENROLL}','{LEAD}','{UNIT}','Matrícula',true,current_date);")
    for group, chat in [('comercial', -1001), ('gerencia', -1002), ('coordenadores', -1003)]:
        sql(f"INSERT INTO telegram_groups(unidade_id,group_type,name,status,telegram_chat_id) VALUES('{UNIT}','{group}','FICTICIO','conectado',{chat});")

def task(i, family, stage):
    t, p = uid(i), 'fu_' + family
    chat = {'matriculados': -1001, 'gerencial': -1002, 'tecnico': -1003}[family]
    c = 'chat_id' if family == 'matriculados' else 'telegram_chat_id'
    m = 'message_id' if family == 'matriculados' else 'telegram_message_id'
    # Avoid conflicting default BV family marker: real identity is defined by enrollment columns.
    sql(f"INSERT INTO tasks(id,titulo,responsavel,unidade_id,status,{p}_lead_id,{p}_matricula_id,{p}_etapa,{p}_{c},{p}_{m}) VALUES('{t}','TESTE {stage}','TESTE','{UNIT}','a_fazer','{LEAD}','{ENROLL}','{stage}',{chat},1);")
    return t, p, chat

def crm(t, actor, stage, unit=UNIT):
    return f"SELECT fu_crm_confirmar_envio('{t}','{actor}','{LEAD}','{ENROLL}','{unit}','{stage}');"

def run():
    seed()
    checks = 0
    allowed = {'matriculados': ['admin', 'user', 'moderator'], 'gerencial': ['admin', 'gerente'], 'tecnico': ['admin', 'gerente', 'coordenador']}
    counter = 300
    for family, stages in [('matriculados', ['BV', 'M+3', 'M+32']), ('gerencial', ['M+15', 'M+30']), ('tecnico', ['M+7', 'M+21'])]:
        for stage in stages:
            for role, actor in ACTORS.items():
                counter += 1
                t, p, _ = task(counter, family, stage)
                if role in allowed[family]:
                    r = json.loads(sql(crm(t, actor, stage)))
                    assert r['ok'] and not r['duplicado']
                    assert sql(f"SELECT count(*) FROM task_history WHERE task_id='{t}'") == '1'
                    assert sql(f"SELECT count(*) FROM contato_execucoes WHERE chave='manual:{p}:{t}'") == '1'
                    assert sql(f"SELECT resultado LIKE '%CRM%' FROM contato_execucoes WHERE chave='manual:{p}:{t}'") == 't'
                    assert sql(f"SELECT status FROM tasks WHERE id='{t}'") == 'a_fazer'
                    assert json.loads(sql(crm(t, actor, stage)))['duplicado']
                    checks += 6
                else:
                    denied(crm(t, actor, stage))
                    checks += 1
            # Both channel orderings plus concurrent real row locks.
            for winner in ['crm', 'telegram', 'race']:
                counter += 1
                t, p, chat = task(counter, family, stage)
                actor = ACTORS[{'matriculados': 'user', 'gerencial': 'gerente', 'tecnico': 'coordenador'}[family]]
                c = crm(t, actor, stage)
                tele = f"SELECT {p}_confirmar_envio('{t}',{int(actor[-12:])},{chat},1);"
                if winner == 'race':
                    with concurrent.futures.ThreadPoolExecutor(2) as ex:
                        results = list(ex.map(lambda q: json.loads(sql(q)), [c, tele]))
                else:
                    results = [json.loads(sql(q)) for q in ([c, tele] if winner == 'crm' else [tele, c])]
                assert all(r['ok'] for r in results) and sorted(r['duplicado'] for r in results) == [False, True]
                assert sql(f"SELECT count(*) FROM task_history WHERE task_id='{t}'") == '1'
                assert sql(f"SELECT count(*) FROM contato_execucoes WHERE chave='manual:{p}:{t}'") == '1'
                expected = 'CRM' if winner == 'crm' else 'Telegram' if winner == 'telegram' else None
                if expected:
                    assert sql(f"SELECT resultado LIKE '%{expected}%' FROM contato_execucoes WHERE chave='manual:{p}:{t}'") == 't'
                checks += 3 + bool(expected)
            denied('SET ROLE authenticated;' + crm(t, ACTORS['admin'], stage))
            denied(crm(t, ACTORS['user'], stage, OTHER))
            checks += 2
    for n, stage in enumerate(['D+1', 'D+7', 'D+15'], 800):
        f = uid(n)
        sql(f"INSERT INTO follow_ups(id,lead_id,unidade_id,tipo,data_referencia,data_prevista) VALUES('{f}','{LEAD}','{UNIT}','{stage}',now(),now());")
        query = f"SELECT fu_comercial_confirmar_transacional('{f}','{ACTORS['user']}','{LEAD}','{UNIT}','{stage}');"
        with concurrent.futures.ThreadPoolExecutor(2) as ex:
            results = list(ex.map(lambda _: json.loads(sql(query)), range(2)))
        assert sorted(r['alreadyConfirmed'] for r in results) == [False, True]
        assert all(not r['historyPending'] for r in results)
        hid = next(r['historyId'] for r in results if 'historyId' in r)
        assert sql(f"SELECT count(*) FROM interacoes WHERE id='{hid}' AND tipo='Follow Up'") == '1'
        denied(query.replace(ACTORS['user'], ACTORS['moderator']))
        at = sql(f'''SELECT to_char(concluido_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM follow_ups WHERE id='{f}';''')
        b = bytearray(hashlib.sha256(f'fu-confirmation:{f}:{at}'.encode()).digest()[:16])
        b[6] = (b[6] & 15) | 80
        b[8] = (b[8] & 63) | 128
        assert str(uuid.UUID(bytes=bytes(b))) == hid
        checks += 5
    print(f'{checks} structural assertions passed; real public triggers, RLS, constraints, evidence and callbacks; no outbound transport')

if __name__ == '__main__':
    run()