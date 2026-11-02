-- Central blocking configuration is server-managed; browser edits cannot activate it.
CREATE FUNCTION public.contato_config_proteger() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF (CASE WHEN TG_OP='DELETE' THEN OLD.chave ELSE NEW.chave END)='contato_central_config'
 AND current_user NOT IN ('postgres','service_role','supabase_admin') THEN RAISE EXCEPTION 'Ativação do controle restrita ao serviço após aprovação'; END IF;
 IF TG_OP='UPDATE' AND OLD.chave='contato_central_config' AND current_user NOT IN ('postgres','service_role','supabase_admin') THEN RAISE EXCEPTION 'Configuração restrita ao serviço'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contato_config_proteger() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER contato_config_proteger BEFORE INSERT OR UPDATE OR DELETE ON public.app_config FOR EACH ROW EXECUTE FUNCTION public.contato_config_proteger();