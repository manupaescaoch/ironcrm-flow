-- Synthetic operations only; assertions run against disposable database.
DO $$
DECLARE u uuid;actor uuid:=gen_random_uuid();l uuid;c uuid;i uuid;r jsonb;cmd jsonb;before_count integer;other uuid:=gen_random_uuid();n uuid;
BEGIN
 SELECT unidade_id INTO u FROM experimental_ciclos_config LIMIT 1;
 INSERT INTO user_unidades VALUES(actor,u);
 INSERT INTO leads(unidade_id) VALUES(u) RETURNING id INTO l;
 cmd:=jsonb_build_object('operacao','criar','unidade_id',u,'lead_id',l,'chave','op-create','data',current_date,'hora','16:00','descricao','initial');
 r:=experimental_operar(actor,cmd);c:=(r->>'ciclo_id')::uuid;i:=(r->>'interacao_id')::uuid;
 PERFORM fixture_assert((SELECT compareceu IS NULL AND experimental_ciclo_atual_id=c FROM interacoes WHERE id=i),'atomic create initializes pending interaction and cycle');
 PERFORM fixture_assert((SELECT hora_aula_experimental='16:00' FROM leads WHERE id=l),'atomic create synchronizes lead compatibility slot');
 PERFORM fixture_assert(experimental_operar(actor,cmd)->>'repetido'='true','same create command retry returns committed result');
 PERFORM fixture_assert((SELECT count(*)=1 FROM interacoes WHERE lead_id=l),'create retry never duplicates interaction');
 BEGIN PERFORM experimental_operar(actor,cmd||'{"hora":"17:00"}');RAISE EXCEPTION 'expected collision';EXCEPTION WHEN OTHERS THEN IF SQLERRM='expected collision' THEN RAISE;END IF;END;
 PERFORM fixture_assert((SELECT hora_aula='16:00' FROM experimental_ciclos WHERE id=c),'different payload same key rejected');
 UPDATE leads SET hora_aula_experimental='18:00' WHERE id=l;
 PERFORM fixture_assert((SELECT hora_experimental='16:00' FROM interacoes WHERE id=i),'inverse lead time trigger preserves tracked slot');
 cmd:=jsonb_build_object('operacao','editar','unidade_id',u,'ciclo_id',c,'versao',0,'chave','op-edit','descricao','metadata only');
 r:=experimental_operar(actor,cmd);
 PERFORM fixture_assert((SELECT compareceu IS NULL AND descricao='metadata only' FROM interacoes WHERE id=i),'metadata edit never infers absence');
 PERFORM fixture_assert((SELECT versao=1 FROM experimental_ciclos WHERE id=c),'metadata edit advances optimistic version');
 cmd:=jsonb_build_object('operacao','confirmar','unidade_id',u,'ciclo_id',c,'versao',1,'chave','op-presence','resultado','compareceu');
 BEGIN PERFORM experimental_operar(actor,cmd);RAISE EXCEPTION 'expected trainer';EXCEPTION WHEN OTHERS THEN IF SQLERRM='expected trainer' THEN RAISE;END IF;END;
 PERFORM fixture_assert((SELECT resultado='pendente' FROM experimental_ciclos WHERE id=c),'missing trainer does not partially confirm');
 r:=experimental_operar(actor,cmd||'{"treinador":"fixture trainer"}');
 PERFORM fixture_assert((SELECT compareceu AND treinador_experimental='FIXTURE TRAINER' FROM interacoes WHERE id=i),'presence and trainer commit atomically');
 SELECT count(*) INTO before_count FROM follow_ups WHERE lead_id=l;
 r:=experimental_operar(actor,cmd||'{"treinador":"fixture trainer"}');
 PERFORM fixture_assert((SELECT count(*)=before_count FROM follow_ups WHERE lead_id=l),'retry does not restart follow ups');
 BEGIN PERFORM experimental_operar(other,cmd);RAISE EXCEPTION 'expected scope';EXCEPTION WHEN OTHERS THEN IF SQLERRM='expected scope' THEN RAISE;END IF;END;
 PERFORM fixture_assert((SELECT versao=2 FROM experimental_ciclos WHERE id=c),'cross unit actor cannot mutate state');
 cmd:=jsonb_build_object('operacao','reagendar','unidade_id',u,'ciclo_id',c,'versao',2,'chave','op-rebook','data',current_date+2,'hora','13:00','motivo','fixture correction');
 r:=experimental_operar(actor,cmd);
 PERFORM fixture_assert((SELECT situacao='substituido' AND resultado='compareceu' FROM experimental_ciclos WHERE id=c),'rebooking preserves original attendance evidence');
 PERFORM fixture_assert((SELECT resultado='pendente' AND hora_aula='13:00' FROM experimental_ciclos WHERE id=(r->>'ciclo_id')::uuid),'atomic successor pending');
 PERFORM fixture_assert((SELECT hora_aula_experimental='13:00' FROM leads WHERE id=l),'rebooking synchronizes lead in same transaction');
 PERFORM fixture_assert(experimental_operar(actor,cmd)->>'repetido'='true','rebooking retry idempotent');
 c:=(r->>'ciclo_id')::uuid;
 cmd:=jsonb_build_object('operacao','inativar','unidade_id',u,'ciclo_id',c,'versao',0,'chave','op-inactivate','motivo','incorrect appointment');
 r:=experimental_operar(actor,cmd);
 PERFORM fixture_assert((SELECT situacao='cancelado' FROM experimental_ciclos WHERE id=c),'inactivation cancels operational appointment');
 PERFORM fixture_assert((SELECT count(*)=2 FROM experimental_ciclos WHERE interacao_id=i),'inactivation retains both cycles');
 PERFORM fixture_assert((SELECT count(*)=0 FROM experimental_ciclo_contexto),'orchestrated operations leave no transaction context');
END $$;

-- Actual role switch rather than owner-only logical scope tests.
ALTER ROLE service_role BYPASSRLS;
GRANT SELECT ON user_roles,user_unidades TO authenticated;
BEGIN;
SELECT set_config('test.uid',(SELECT usuario_id::text FROM experimental_comandos LIMIT 1),true);
SET LOCAL ROLE authenticated;
SELECT fixture_assert((SELECT count(*)>0 FROM experimental_ciclos),'authenticated user reads own unit via actual RLS');
DO $$BEGIN
 BEGIN UPDATE experimental_ciclos SET resultado='compareceu';RAISE EXCEPTION 'unexpected update';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM experimental_operar(auth.uid(),'{}');RAISE EXCEPTION 'unexpected execute';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
ROLLBACK;
BEGIN;
SELECT set_config('test.uid',gen_random_uuid()::text,true);
SET LOCAL ROLE authenticated;
SELECT fixture_assert((SELECT count(*)=0 FROM experimental_ciclos),'unlinked authenticated user reads no cycles via RLS');
SELECT fixture_assert((SELECT count(*)=0 FROM experimental_ciclo_eventos),'unlinked authenticated user reads no evidence via RLS');
RESET ROLE;
ROLLBACK;