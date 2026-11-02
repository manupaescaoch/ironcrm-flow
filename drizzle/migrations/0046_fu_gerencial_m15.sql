ALTER TABLE public.tasks DROP CONSTRAINT tasks_fu_gerencial_etapa_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_fu_gerencial_etapa_check CHECK (fu_gerencial_etapa IN ('M+15','M+30'));
CREATE OR REPLACE FUNCTION public.fu_gerencial_m15_inicio() RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$ SELECT '2026-11-02T19:00:00Z'::timestamptz $$;
REVOKE ALL ON FUNCTION public.fu_gerencial_m15_inicio() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fu_gerencial_m15_inicio() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.fu_gerencial_nova_matricula() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l public.leads;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.cancelado=true OR NEW.fechou_matricula IS DISTINCT FROM true) THEN UPDATE public.tasks SET fu_gerencial_status='cancelado',fu_gerencial_envio_erro='Matrícula cancelada' WHERE fu_gerencial_matricula_id=NEW.id AND fu_gerencial_status IN ('pendente','em_andamento'); END IF;
 IF NEW.fechou_matricula IS DISTINCT FROM true OR NEW.data_fechamento IS NULL OR NEW.cancelado=true OR NEW.created_at<public.fu_gerencial_inicio() OR NEW.data_fechamento<(public.fu_gerencial_inicio() AT TIME ZONE 'America/Recife')::date THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.fechou_matricula=true AND OLD.data_fechamento IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO l FROM public.leads WHERE id=NEW.lead_id;
 IF l.ativo IS DISTINCT FROM true OR l.unidade_id IS NULL THEN RETURN NEW; END IF;
 UPDATE public.tasks SET fu_gerencial_status='cancelado',fu_gerencial_envio_erro='Novo ciclo de matrícula' WHERE fu_gerencial_lead_id=l.id AND fu_gerencial_matricula_id<>NEW.id AND fu_gerencial_status IN ('pendente','em_andamento');
 IF NEW.created_at>=public.fu_gerencial_m15_inicio() THEN
  INSERT INTO public.tasks(titulo,descricao,responsavel,setor,prioridade,prazo,unidade_id,fu_gerencial_lead_id,fu_gerencial_matricula_id,fu_gerencial_etapa,fu_gerencial_status,notificado_24h,notificado_prazo) VALUES('ACOMPANHAMENTO GERENCIAL | M+15 | '||l.nome,'EXPERIÊNCIA INICIAL: IDENTIFICAR INSATISFAÇÕES E NECESSIDADES DE MELHORIA. CONSULTAR HISTÓRICO ANTES DO CONTATO.','[GERENTE]','GERENCIA','media',public.fu_next_weekday(NEW.data_fechamento+15),l.unidade_id,l.id,NEW.id,'M+15','pendente',true,true) ON CONFLICT DO NOTHING;
 END IF;
 INSERT INTO public.tasks(titulo,descricao,responsavel,setor,prioridade,prazo,unidade_id,fu_gerencial_lead_id,fu_gerencial_matricula_id,fu_gerencial_etapa,fu_gerencial_status,notificado_24h,notificado_prazo) VALUES('ACOMPANHAMENTO GERENCIAL | M+30 | '||l.nome,'CONSULTAR HISTÓRICO ANTES DO CONTATO. VERIFICAR EXPERIÊNCIA, RECLAMAÇÕES E PROVIDÊNCIAS. NÃO REPETIR PERGUNTAS JÁ RESPONDIDAS.','[GERENTE]','GERENCIA','media',public.fu_next_weekday(NEW.data_fechamento+30),l.unidade_id,l.id,NEW.id,'M+30','pendente',true,true) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fu_gerencial_nova_matricula() FROM PUBLIC,anon,authenticated;