-- Fixtures only: run against the isolated bootstrap database, never production.
INSERT INTO leads VALUES('00000000-0000-4000-8000-000000000010','ALUNO','00000000-0000-4000-8000-000000000001',true,false,false,'agendado','2026-10-30','10:00');
INSERT INTO interacoes(id,lead_id,unidade_id,agendou_experimental,compareceu,data_experimental,hora_experimental)
VALUES('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001',true,false,'2026-10-30','10:00');
DO $$
DECLARE r jsonb; again jsonb; key text := 'send-reagendamento-experimental:00000000-0000-4000-8000-000000000010:00000000-0000-4000-8000-000000000020:2026-10-30:10:00';
BEGIN
 r:=fu_reag_reservar('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000020',key,'EQUIPE');
 ASSERT (r->>'claimed')::boolean, 'first reservation';
 ASSERT (SELECT tipo='REAG' AND status='enviando' FROM follow_ups WHERE id=(r->>'id')::uuid), 'REAG accepted before send';
 again:=fu_reag_reservar('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000020',key,'EQUIPE');
 ASSERT NOT (again->>'claimed')::boolean, 'duplicate blocked';
 PERFORM fu_reag_finalizar((r->>'id')::uuid,key,'ambiguo',502);
 PERFORM fu_reag_finalizar((r->>'id')::uuid,key,'enviado',200);
 ASSERT (SELECT reag_eventos->key->>'estado'='ambiguo' FROM follow_ups WHERE id=(r->>'id')::uuid), 'ambiguous result immutable';
 ASSERT (SELECT count(*)=1 FROM interacoes WHERE tipo='whatsapp'), 'history unique';
 ASSERT (SELECT unidade_id='00000000-0000-4000-8000-000000000001' AND lead_id='00000000-0000-4000-8000-000000000010' FROM interacoes WHERE tipo='whatsapp'), 'history unit and lead';
 UPDATE leads SET hora_aula_experimental='11:00' WHERE id='00000000-0000-4000-8000-000000000010';
 UPDATE interacoes SET hora_experimental='11:00' WHERE id='00000000-0000-4000-8000-000000000020';
 key:=replace(key,'10:00','11:00');
 r:=fu_reag_reservar('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000020',key,'EQUIPE');
 ASSERT (r->>'claimed')::boolean, 'new slot eligible';
 ASSERT (SELECT count(*)=1 FROM follow_ups WHERE tipo='REAG'), 'one legacy follow-up with separate events';
 ASSERT (SELECT count(*)=2 FROM follow_ups,jsonb_object_keys(reag_eventos)), 'old event preserved';
 PERFORM fu_reag_finalizar((r->>'id')::uuid,key,'enviado',200);
 ASSERT (SELECT status='concluido' FROM follow_ups WHERE id=(r->>'id')::uuid), 'confirmed success';
 ASSERT NOT has_function_privilege('authenticated','fu_reag_reservar(uuid,uuid,text,text)','EXECUTE'), 'user cannot reserve directly';
 ASSERT NOT has_function_privilege('anon','fu_reag_finalizar(uuid,text,text,integer)','EXECUTE'), 'anon cannot confirm';
 ASSERT has_function_privilege('service_role','fu_reag_reservar(uuid,uuid,text,text)','EXECUTE'), 'service authorized';
END $$;
INSERT INTO follow_ups(lead_id,unidade_id,tipo,status,data_referencia,data_prevista) SELECT '00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001',t,'pendente',now(),now() FROM unnest(ARRAY['D+1','D+7','D+15','D+30','M+7','M+30','G+7','G+30']) t ON CONFLICT(lead_id,tipo) DO NOTHING;
DO $$ BEGIN ASSERT (SELECT count(*)=8 FROM follow_ups WHERE tipo<>'REAG'),'all legacy types preserved'; END $$;