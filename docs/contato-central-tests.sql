-- Isolated fixtures only. Never run against production.
INSERT INTO unidades VALUES('00000000-0000-4000-8000-000000000001','BOA VIAGEM'),('00000000-0000-4000-8000-000000000002','SETUBAL');
INSERT INTO leads(id,unidade_id,nome,telefone) VALUES('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001','ALUNO A','5581999999999'),('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','ALUNO B','5581999999999');
CREATE FUNCTION public.test_intent(k text,flow text DEFAULT 'test',priority int DEFAULT 4,nonurgent boolean DEFAULT true,exception text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('lead_id','00000000-0000-4000-8000-000000000010','unidade_id','00000000-0000-4000-8000-000000000001','chave',k,'fluxo',flow,'objetivo','conversao','setor','comercial','canal','whatsapp','prioridade',priority,'nao_urgente',nonurgent,'excecao',exception,'prazo_original',now()-interval '1 hour')
$$;
DO $$
DECLARE d jsonb; r jsonb; lead uuid:='00000000-0000-4000-8000-000000000010'; cycle uuid:='00000000-0000-4000-8000-000000000020';
BEGIN
 ASSERT contato_modo('test','00000000-0000-4000-8000-000000000001')='observacao','default observation';
 PERFORM contato_registrar_evidencia(lead,'00000000-0000-4000-8000-000000000001','confirmed','crm_manual','tecnico',cycle,'M+7','coordenador','presencial','COORD',now()-interval '1 hour','Contato presencial',2);
 d:=contato_avaliar(lead,'conversao',cycle,4,false,NULL,'new');
 ASSERT d->>'elegivel'='false' AND d->>'motivo'='intervalo_24h','24h';
 d:=contato_avaliar(lead,'experiencia',cycle,3,true,NULL,'new');
 ASSERT d->>'motivo'='intervalo_72h','72h cross-sector';
 d:=contato_avaliar(lead,'experiencia',cycle,3,true,NULL,'new',now()+interval '73 hours');
 ASSERT d->>'elegivel'='true','after interval';
 d:=contato_avaliar(lead,'essencial',cycle,1,false,'experimental_24h','essential');
 ASSERT d->>'elegivel'='true' AND d->>'excecao'='experimental_24h','essential exemption';
 d:=contato_avaliar(lead,'urgente',cycle,1,false,'urgencia_operacional','urgent');
 ASSERT d->>'elegivel'='true' AND d->>'motivo' LIKE 'Exceção%','urgent recorded';
 r:=contato_observar(test_intent('observe'));
 ASSERT r->>'permitido'='true','observation does not block';
 ASSERT (SELECT estado='pendente' AND enviado_em IS NULL AND proxima_tentativa IS NOT NULL FROM contato_execucoes WHERE chave='observe'),'internal notification not sent';
 INSERT INTO app_config VALUES('contato_central_config','{"fluxos":{"test":{"00000000-0000-4000-8000-000000000001":"ativo"}}}');
 r:=contato_reservar(test_intent('delayed'));
 ASSERT r->>'permitido'='false','active policy delays';
 ASSERT (SELECT estado='adiado' AND acompanhamento_concluido_em IS NULL AND prazo_original<now() AND proxima_tentativa>now() FROM contato_execucoes WHERE chave='delayed'),'dates separate and pending';
 r:=contato_reservar(test_intent('delayed'));
 ASSERT r->>'permitido'='false','next attempt not repeated early';
 d:=contato_avaliar('00000000-0000-4000-8000-000000000011','conversao',NULL,4,true,NULL,'other-person');
 ASSERT d->>'elegivel'='true','shared phone distinct person';
 UPDATE leads SET unidade_id='00000000-0000-4000-8000-000000000002' WHERE id=lead;
 d:=contato_avaliar(lead,'experiencia',cycle,3,true,NULL,'transferred');
 ASSERT d->>'elegivel'='false','transfer retains contact';
 ASSERT (SELECT unidade_id='00000000-0000-4000-8000-000000000001' FROM contato_execucoes WHERE chave='confirmed'),'original unit immutable';
 UPDATE leads SET unidade_id='00000000-0000-4000-8000-000000000001' WHERE id=lead;
 INSERT INTO tasks(id,unidade_id,prazo,fu_tecnico_lead_id,fu_tecnico_matricula_id,fu_tecnico_status) VALUES('00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000001',current_date,lead,cycle,'pendente');
 d:=contato_avaliar(lead,'experiencia',cycle,3,true,NULL,'manager',now()+interval '73 hours');
 ASSERT d->>'motivo'='prioridade_superior_pendente','technical above manager';
 d:=contato_avaliar(lead,'experiencia','00000000-0000-4000-8000-000000000021',3,true,NULL,'new-cycle',now()+interval '73 hours');
 ASSERT d->>'elegivel'='true','renewal does not inherit old task objective';
 UPDATE tasks SET fu_tecnico_confirmado_em=now(),fu_tecnico_confirmado_nome='COORD' WHERE id='00000000-0000-4000-8000-000000000030';
 ASSERT EXISTS(SELECT 1 FROM contato_execucoes WHERE chave='manual:fu_tecnico:00000000-0000-4000-8000-000000000030' AND estado='enviado'),'manual confirmed counted';
 INSERT INTO interacoes(lead_id,unidade_id,created_by,tipo,descricao,atendido_por,contato_meta) VALUES(lead,'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000040','Presencial','CONVERSA REAL','RECEPCAO','{"estado":"enviado","objetivo":"operacional","canal":"presencial","setor":"recepcao","resultado":"RESOLVIDO"}');
 ASSERT EXISTS(SELECT 1 FROM contato_execucoes WHERE fluxo='crm_manual' AND canal='presencial'),'CRM presence counted';
 ASSERT NOT has_function_privilege('authenticated','contato_reservar(jsonb)','EXECUTE'),'no direct user reserve';
 ASSERT NOT has_function_privilege('anon','contato_resultado(uuid,text,text)','EXECUTE'),'no public result';
END $$;
-- Independent fixture for concurrency and uncertainty: no prior confirmed contacts.
UPDATE app_config SET valor='{"fluxos":{"race":{"00000000-0000-4000-8000-000000000001":"ativo"}}}' WHERE chave='contato_central_config';
CREATE FUNCTION race_intent(k text) RETURNS jsonb LANGUAGE sql AS $$ SELECT test_intent(k,'race',2,false)||'{"lead_id":"00000000-0000-4000-8000-000000000011"}'::jsonb $$;-- Essential flags produce exempt evidence without interfering with proactive policy.
UPDATE leads SET confirmacao_24h_enviada_em=now(),confirmacao_2h_enviada_em=now() WHERE id='00000000-0000-4000-8000-000000000010';
DO $$ BEGIN ASSERT (SELECT count(*)=2 FROM contato_execucoes WHERE fluxo='experimental_essencial' AND excecao='confirmacao_essencial'),'24h and 2h exempt'; END $$;
