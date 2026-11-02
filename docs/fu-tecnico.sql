-- Fase 1: somente eventos de matrícula posteriores à instalação. Sem backfill.
ALTER TABLE public.tasks
 ADD COLUMN fu_tecnico_lead_id uuid REFERENCES public.leads(id),
 ADD COLUMN fu_tecnico_matricula_id uuid REFERENCES public.interacoes(id),
 ADD COLUMN fu_tecnico_etapa text CHECK (fu_tecnico_etapa IN ('M+7','M+21')),
 ADD COLUMN fu_tecnico_status text CHECK (fu_tecnico_status IN ('pendente','em_andamento','concluido','dispensado','cancelado')),
 ADD COLUMN fu_tecnico_registro jsonb,
 ADD COLUMN fu_tecnico_envio_dia date,
 ADD COLUMN fu_tecnico_envio_status text,
 ADD COLUMN fu_tecnico_envio_erro text;
CREATE UNIQUE INDEX tasks_fu_tecnico_ciclo ON public.tasks(fu_tecnico_lead_id,fu_tecnico_matricula_id,fu_tecnico_etapa) WHERE fu_tecnico_etapa IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fu_tecnico_validar_tarefa() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r jsonb; v_user text;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.fu_tecnico_etapa IS NOT NULL THEN RAISE EXCEPTION 'FU técnico possui histórico; cancele ou dispense, não exclua.'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.fu_tecnico_etapa IS NOT NULL AND
  (NEW.fu_tecnico_lead_id IS DISTINCT FROM OLD.fu_tecnico_lead_id OR NEW.fu_tecnico_matricula_id IS DISTINCT FROM OLD.fu_tecnico_matricula_id OR NEW.fu_tecnico_etapa IS DISTINCT FROM OLD.fu_tecnico_etapa) THEN
  RAISE EXCEPTION 'Identidade do acompanhamento não pode ser alterada.';
 END IF;
 IF NEW.fu_tecnico_etapa IS NULL THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL THEN
  IF TG_OP='INSERT' THEN RAISE EXCEPTION 'FU técnico é criado pela matrícula.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','gerente','coordenador')) OR
   NOT (public.has_role(auth.uid(),'admin') OR NEW.unidade_id IN (SELECT public.get_user_unidades(auth.uid()))) THEN
   RAISE EXCEPTION 'Somente a coordenação ou gestão da unidade pode registrar o FU técnico.';
  END IF;
  IF NEW.unidade_id IS DISTINCT FROM OLD.unidade_id OR NEW.fu_tecnico_envio_dia IS DISTINCT FROM OLD.fu_tecnico_envio_dia OR NEW.fu_tecnico_envio_status IS DISTINCT FROM OLD.fu_tecnico_envio_status THEN
   RAISE EXCEPTION 'Unidade e envio são controlados pelo sistema.';
  END IF;
  IF OLD.fu_tecnico_status IN ('concluido','dispensado','cancelado') THEN RAISE EXCEPTION 'Acompanhamento encerrado; histórico preservado.'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.fu_tecnico_status IS NOT DISTINCT FROM OLD.fu_tecnico_status THEN
   IF NEW.status='concluida' THEN NEW.fu_tecnico_status='concluido';
   ELSIF NEW.status='em_andamento' THEN NEW.fu_tecnico_status='em_andamento';
   ELSE NEW.fu_tecnico_status='pendente'; END IF;
  END IF;
 END IF;
 IF NEW.fu_tecnico_status IN ('concluido','dispensado') OR (NEW.fu_tecnico_status='cancelado' AND auth.uid() IS NOT NULL) THEN
  r:=NEW.fu_tecnico_registro;
  IF r IS NULL OR coalesce(r->>'data','') !~ '^\d{4}-\d{2}-\d{2}$' OR nullif(trim(r->>'coordenador'),'') IS NULL OR
   coalesce(r->>'canal','') NOT IN ('presencial','whatsapp') OR nullif(trim(r->>'observacoes'),'') IS NULL THEN
   RAISE EXCEPTION 'Registre data, coordenador, canal e observações antes de encerrar.';
  END IF;
  IF (r->>'data')::date > (now() AT TIME ZONE 'America/Recife')::date THEN RAISE EXCEPTION 'Data de acompanhamento não pode ser futura.'; END IF;
 END IF;
 NEW.status:=CASE WHEN NEW.fu_tecnico_status IN ('concluido','dispensado','cancelado') THEN 'concluida' WHEN NEW.fu_tecnico_status='em_andamento' THEN 'em_andamento' ELSE 'a_fazer' END;
 NEW.recorrencia:=NULL; NEW.recorrencia_fim:=NULL;
 NEW.notificado_24h:=true; NEW.notificado_prazo:=true;
 IF TG_OP='UPDATE' AND (NEW.fu_tecnico_status IS DISTINCT FROM OLD.fu_tecnico_status OR NEW.fu_tecnico_registro IS DISTINCT FROM OLD.fu_tecnico_registro OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id) THEN
  SELECT coalesce(nome,'SISTEMA') INTO v_user FROM public.user_profiles WHERE user_id=auth.uid();
  INSERT INTO public.task_history(task_id,user_id,user_name,campo,valor_anterior,valor_novo)
   VALUES(NEW.id,auth.uid(),coalesce(v_user,'SISTEMA'),'acompanhamento_tecnico',jsonb_build_object('status',OLD.fu_tecnico_status,'registro',OLD.fu_tecnico_registro,'unidade',OLD.unidade_id)::text,jsonb_build_object('status',NEW.fu_tecnico_status,'registro',NEW.fu_tecnico_registro,'unidade',NEW.unidade_id)::text);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aaa_fu_tecnico_validar BEFORE INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.fu_tecnico_validar_tarefa();

CREATE OR REPLACE FUNCTION public.fu_tecnico_nova_matricula() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l public.leads; n integer;
BEGIN
 IF NEW.fechou_matricula IS DISTINCT FROM true OR NEW.data_fechamento IS NULL OR NEW.cancelado=true THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.fechou_matricula=true THEN RETURN NEW; END IF;
 SELECT * INTO l FROM public.leads WHERE id=NEW.lead_id;
 IF l.ativo IS DISTINCT FROM true OR l.unidade_id IS NULL THEN RETURN NEW; END IF;
 -- No auth-derived grants are widened: creation is performed by this event trigger.
 FOR n IN SELECT unnest(ARRAY[7,21]) LOOP
  INSERT INTO public.tasks(titulo,descricao,responsavel,setor,prioridade,prazo,unidade_id,fu_tecnico_lead_id,fu_tecnico_matricula_id,fu_tecnico_etapa,fu_tecnico_status,notificado_24h,notificado_prazo)
  VALUES('ACOMPANHAMENTO TÉCNICO | M+'||n||' | '||l.nome,
   'CONSULTAR HISTÓRICO DO ALUNO, TREINOS E TREINADOR RESPONSÁVEL. VERIFICAR DIFICULDADES E ACOMPANHAMENTOS PRESENCIAIS. NÃO INVENTAR RESULTADOS.',
   '[COORDENADOR]','TECNICO','media',NEW.data_fechamento+n,l.unidade_id,l.id,NEW.id,'M+'||n,'pendente',true,true)
  ON CONFLICT DO NOTHING;
 END LOOP;
 RETURN NEW;
END $$;
-- Trigger-generated inserts bypass only the technical INSERT prohibition via trigger depth.
CREATE TRIGGER fu_tecnico_matricula AFTER INSERT OR UPDATE OF fechou_matricula ON public.interacoes FOR EACH ROW EXECUTE FUNCTION public.fu_tecnico_nova_matricula();

CREATE OR REPLACE FUNCTION public.fu_tecnico_sincronizar_aluno() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.tasks SET unidade_id=NEW.unidade_id,
  fu_tecnico_status=CASE WHEN NEW.ativo IS DISTINCT FROM true OR NEW.is_matriculado IS DISTINCT FROM true OR NEW.status_funil='perdido' THEN 'cancelado' ELSE fu_tecnico_status END,
  fu_tecnico_envio_erro=CASE WHEN NEW.ativo IS DISTINCT FROM true OR NEW.is_matriculado IS DISTINCT FROM true OR NEW.status_funil='perdido' THEN 'Aluno inativo ou matrícula cancelada' ELSE fu_tecnico_envio_erro END
 WHERE fu_tecnico_lead_id=NEW.id AND fu_tecnico_status IN ('pendente','em_andamento');
 RETURN NEW;
END $$;
CREATE TRIGGER fu_tecnico_aluno AFTER UPDATE OF unidade_id,ativo,is_matriculado,status_funil ON public.leads FOR EACH ROW EXECUTE FUNCTION public.fu_tecnico_sincronizar_aluno();

CREATE OR REPLACE FUNCTION public.fu_tecnico_claim(p_task uuid,p_dia date) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.tasks t SET fu_tecnico_envio_dia=p_dia,fu_tecnico_envio_status='reservado',fu_tecnico_envio_erro=NULL
 WHERE t.id=p_task AND t.fu_tecnico_status IN ('pendente','em_andamento') AND t.prazo<=p_dia AND (t.fu_tecnico_envio_dia IS NULL OR t.fu_tecnico_envio_dia<p_dia)
 AND EXISTS (SELECT 1 FROM public.leads l JOIN public.interacoes i ON i.id=t.fu_tecnico_matricula_id WHERE l.id=t.fu_tecnico_lead_id AND l.unidade_id=t.unidade_id AND l.ativo=true AND l.is_matriculado=true AND l.status_funil<>'perdido' AND i.fechou_matricula=true AND i.cancelado IS DISTINCT FROM true);
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.fu_tecnico_claim(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fu_tecnico_claim(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.fu_tecnico_validar_tarefa(),public.fu_tecnico_nova_matricula(),public.fu_tecnico_sincronizar_aluno() FROM PUBLIC,anon,authenticated;