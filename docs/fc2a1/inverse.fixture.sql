-- Exact deployed inverse time attachment plus downstream lead bodies; inert network only.
CREATE TRIGGER trigger_sync_interacoes_hora AFTER UPDATE OF hora_aula_experimental ON public.leads FOR EACH ROW EXECUTE FUNCTION sync_interacoes_hora_from_lead();
ALTER TABLE public.tasks ADD COLUMN fu_matriculados_chat_id bigint,ADD COLUMN fu_matriculados_message_id bigint;
CREATE FUNCTION public.fu_gerencial_sincronizar_aluno() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.tasks SET unidade_id=NEW.unidade_id,fu_gerencial_status=CASE WHEN NEW.ativo IS DISTINCT FROM true OR NEW.is_matriculado IS DISTINCT FROM true OR NEW.status_funil='perdido' THEN 'cancelado' ELSE fu_gerencial_status END,fu_gerencial_envio_erro=CASE WHEN NEW.ativo IS DISTINCT FROM true OR NEW.is_matriculado IS DISTINCT FROM true OR NEW.status_funil='perdido' THEN 'Aluno inativo ou matrícula cancelada' ELSE fu_gerencial_envio_erro END WHERE fu_gerencial_lead_id=NEW.id AND fu_gerencial_status IN ('pendente','em_andamento');RETURN NEW;
END $$;
CREATE FUNCTION public.fu_tecnico_sincronizar_aluno() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.tasks SET unidade_id=NEW.unidade_id,fu_tecnico_status=CASE WHEN NEW.ativo IS DISTINCT FROM true OR NEW.is_matriculado IS DISTINCT FROM true OR NEW.status_funil='perdido' THEN 'cancelado' ELSE fu_tecnico_status END,fu_tecnico_envio_erro=CASE WHEN NEW.ativo IS DISTINCT FROM true OR NEW.is_matriculado IS DISTINCT FROM true OR NEW.status_funil='perdido' THEN 'Aluno inativo ou matrícula cancelada' ELSE fu_tecnico_envio_erro END WHERE fu_tecnico_lead_id=NEW.id AND fu_tecnico_status IN ('pendente','em_andamento');RETURN NEW;
END $$;
CREATE FUNCTION public.fu_matriculados_sincronizar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.tasks SET unidade_id=NEW.unidade_id,status=CASE WHEN NEW.ativo IS DISTINCT FROM true OR NEW.is_matriculado IS DISTINCT FROM true OR NEW.status_funil='perdido' THEN 'concluida' ELSE status END,fu_matriculados_envio_erro=CASE WHEN NEW.ativo IS DISTINCT FROM true OR NEW.is_matriculado IS DISTINCT FROM true OR NEW.status_funil='perdido' THEN 'Aluno ou matrícula inativo' ELSE fu_matriculados_envio_erro END,fu_matriculados_chat_id=CASE WHEN NEW.unidade_id IS DISTINCT FROM OLD.unidade_id THEN NULL ELSE fu_matriculados_chat_id END,fu_matriculados_message_id=CASE WHEN NEW.unidade_id IS DISTINCT FROM OLD.unidade_id THEN NULL ELSE fu_matriculados_message_id END WHERE fu_matriculados_lead_id=NEW.id AND fu_matriculados_confirmado_em IS NULL AND status<>'concluida';RETURN NEW;
END $$;
CREATE TRIGGER fu_gerencial_aluno AFTER UPDATE OF unidade_id,ativo,is_matriculado,status_funil ON public.leads FOR EACH ROW EXECUTE FUNCTION fu_gerencial_sincronizar_aluno();
CREATE TRIGGER fu_tecnico_aluno AFTER UPDATE OF unidade_id,ativo,is_matriculado,status_funil ON public.leads FOR EACH ROW EXECUTE FUNCTION fu_tecnico_sincronizar_aluno();
CREATE TRIGGER fu_matriculados_aluno AFTER UPDATE OF unidade_id,ativo,is_matriculado,status_funil ON public.leads FOR EACH ROW EXECUTE FUNCTION fu_matriculados_sincronizar();