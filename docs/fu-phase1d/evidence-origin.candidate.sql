-- ISOLATED ONLY: narrow origin/stage correction; preserves keys, spacing policy and old evidence.
CREATE OR REPLACE FUNCTION public.contato_tarefa_evidencia() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j jsonb; oldj jsonb; prefix text; person uuid; cycle uuid; objective text; sector text; priority int; r jsonb; d timestamptz; k text; origin text;
BEGIN
 j:=to_jsonb(NEW);oldj:=to_jsonb(OLD);
 origin:=CASE WHEN current_setting('app.fu_confirmation_origin',true)='crm' AND (current_setting('role',true)='service_role' OR session_user NOT IN('anon','authenticated','authenticator')) THEN 'CRM' ELSE 'Telegram' END;
 FOREACH prefix IN ARRAY ARRAY['fu_tecnico','fu_gerencial','fu_matriculados'] LOOP
 person:=nullif(j->>(prefix||'_lead_id'),'')::uuid;cycle:=nullif(j->>(prefix||'_matricula_id'),'')::uuid;IF person IS NULL THEN CONTINUE; END IF;
 objective:=CASE prefix WHEN 'fu_tecnico' THEN 'tecnico' WHEN 'fu_gerencial' THEN 'experiencia' ELSE CASE WHEN j->>'fu_matriculados_etapa' IN('M+3','M+32') THEN 'experiencia' ELSE 'boas_vindas' END END;
 sector:=CASE prefix WHEN 'fu_tecnico' THEN 'coordenador' WHEN 'fu_gerencial' THEN 'gerente' ELSE 'comercial' END;priority:=CASE prefix WHEN 'fu_tecnico' THEN 2 WHEN 'fu_gerencial' THEN 3 ELSE 4 END;
 IF j->>(prefix||'_confirmado_em') IS NOT NULL AND oldj->>(prefix||'_confirmado_em') IS NULL THEN PERFORM public.contato_registrar_evidencia(person,NEW.unidade_id,'manual:'||prefix||':'||NEW.id,prefix,objective,cycle,j->>(prefix||'_etapa'),sector,'whatsapp',j->>(prefix||'_confirmado_nome'),(j->>(prefix||'_confirmado_em'))::timestamptz,'Confirmação manual '||origin||'; etapa '||coalesce(j->>(prefix||'_etapa'),'')||'; acompanhamento separado',priority,CASE WHEN prefix='fu_matriculados' THEN 'transicao_matricula' END); END IF;
 r:=j->(prefix||'_registro');
 IF r IS NOT NULL AND r->>'canal' IN('presencial','whatsapp') AND j->>(prefix||'_status')='concluido' AND oldj->>(prefix||'_status') IS DISTINCT FROM 'concluido' THEN
 d:=((r->>'data')::date+time '23:59:59') AT TIME ZONE 'America/Recife';d:=least(d,now());k:='registro:'||prefix||':'||NEW.id;
 PERFORM public.contato_registrar_evidencia(person,NEW.unidade_id,k,prefix,objective,cycle,j->>(prefix||'_etapa'),sector,r->>'canal',coalesce(r->>'coordenador',r->>'gerente',NEW.responsavel),d,r::text,priority);
 UPDATE public.contato_execucoes SET acompanhamento_concluido_em=now() WHERE chave=k;
 END IF;
 END LOOP;RETURN NEW;
END $$;
