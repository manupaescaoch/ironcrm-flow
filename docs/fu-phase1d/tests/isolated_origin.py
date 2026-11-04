exec(open('/tmp/fu-phase1d/check_sql.py').read().split('q("CREATE ROLE')[0])
q("ALTER TABLE tasks ADD COLUMN responsavel text;CREATE TABLE contato_execucoes(chave text PRIMARY KEY,acompanhamento_concluido_em timestamptz);CREATE TABLE evidence(chave text PRIMARY KEY,objective text,stage text,result text,exception text);CREATE FUNCTION contato_registrar_evidencia(uuid,uuid,text,text,text,uuid,text,text,text,text,timestamptz,text,integer,text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$INSERT INTO evidence VALUES($3,$5,$7,$12,$14) ON CONFLICT(chave) DO NOTHING$$;")
q(open('/dev-server/docs/fu-phase1d/evidence-origin.candidate.sql').read());q('CREATE TRIGGER contato_tarefa_evidencia AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION contato_tarefa_evidencia();')
u=lambda i:f'00000000-0000-4000-8000-{i:012d}'
for i,stage in enumerate(['BV','M+3','M+32'],1):
 t=u(3000+i)
 q(f"INSERT INTO tasks(id,unidade_id,status,fu_matriculados_lead_id,fu_matriculados_matricula_id,fu_matriculados_etapa) VALUES('{t}','{u(1)}','a_fazer','{u(2)}','{u(3)}','{stage}'); SELECT fu_crm_confirmar_envio('{t}','{u(103)}','{u(2)}','{u(3)}','{u(1)}','{stage}');")
 assert 'CRM' in q(f"SELECT result FROM evidence WHERE chave='manual:fu_matriculados:{t}';")
 assert q(f"SELECT objective FROM evidence WHERE chave='manual:fu_matriculados:{t}';")==('boas_vindas' if stage=='BV' else 'experiencia')
print('6 evidence origin/stage assertions passed; isolated collector stub, no policy changes')
